import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import {
  canCreateStockMovement,
  canCreateStockAdjustment,
  getPermissionErrorMessage,
} from '@/lib/rbac'
import { logger } from '@/lib/logger'
import { parseToWIB } from '@/lib/timezone'
import {
  getStockMovementsByDate,
  createStockMovement,
  StockMovementInput,
} from '@/lib/services'
import {
  stockMovementSchemaAPI,
  stockMovementQuerySchema,
} from '@/lib/validations'

export async function GET(request: NextRequest) {
  try {
    // Authentication required (all roles can view)
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = {
      itemId: searchParams.get('itemId'),
      date: searchParams.get('date'),
      itemType: searchParams.get('itemType'),
    }

    const validatedQuery = stockMovementQuerySchema.parse(query)
    const queryDate = parseToWIB(validatedQuery.date)

    // Get stock movements using service
    const movements = await getStockMovementsByDate(
      validatedQuery.itemId,
      validatedQuery.itemType,
      queryDate
    )

    return NextResponse.json(movements)
  } catch (error) {
    logger.error('Error querying stock movements:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to query stock movements' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication required
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validate locationId for finished-good IN movements before parsing
    if (
      body.finishedGoodId &&
      body.type === 'IN' &&
      (!body.locationId || body.locationId.trim() === '')
    ) {
      return NextResponse.json(
        { error: 'Lokasi harus dipilih untuk stok masuk produk jadi' },
        { status: 400 }
      )
    }

    const validatedData = stockMovementSchemaAPI.parse(body)

    // Determine item type for permission check
    const itemType = validatedData.rawMaterialId
      ? 'raw-material'
      : 'finished-good'

    // Check permission - ADJUSTMENT uses separate permission check
    if (validatedData.type === 'ADJUSTMENT') {
      if (!canCreateStockAdjustment(session.user.role)) {
        return NextResponse.json(
          {
            error: getPermissionErrorMessage(
              'create stock adjustments',
              session.user.role
            ),
          },
          { status: 403 }
        )
      }
    } else {
      // Check granular permission based on item type and movement type
      if (
        !canCreateStockMovement(session.user.role, itemType, validatedData.type)
      ) {
        const restriction =
          itemType === 'raw-material' && validatedData.type === 'OUT'
            ? 'Raw material OUT movements can only be created by ADMIN (normally created via batch production)'
            : getPermissionErrorMessage(
                `create ${validatedData.type} movements for ${itemType}s`,
                session.user.role
              )

        return NextResponse.json({ error: restriction }, { status: 403 })
      }
    }

    // For ADJUSTMENT type, calculate adjustment from newStock if provided
    let adjustmentQuantity = validatedData.quantity
    if (validatedData.type === 'ADJUSTMENT' && validatedData.newStock !== undefined) {
      // Import prisma to get current stock
      const { prisma } = await import('@/lib/db')
      
      let currentStock = 0
      if (validatedData.rawMaterialId && validatedData.drumId) {
        // Get drum stock
        const drum = await prisma.drum.findUnique({
          where: { id: validatedData.drumId },
          select: { currentQuantity: true },
        })
        if (!drum) {
          return NextResponse.json({ error: 'Drum not found' }, { status: 404 })
        }
        currentStock = drum.currentQuantity
      } else if (validatedData.rawMaterialId) {
        // Get raw material aggregate stock
        const rawMaterial = await prisma.rawMaterial.findUnique({
          where: { id: validatedData.rawMaterialId },
          select: { currentStock: true },
        })
        if (!rawMaterial) {
          return NextResponse.json({ error: 'Raw material not found' }, { status: 404 })
        }
        currentStock = rawMaterial.currentStock
      } else if (validatedData.finishedGoodId) {
        // Get finished good stock at location
        if (!body.locationId) {
          return NextResponse.json(
            { error: 'Location is required for finished good adjustments' },
            { status: 400 }
          )
        }
        const stock = await prisma.finishedGoodStock.findUnique({
          where: {
            finishedGoodId_locationId: {
              finishedGoodId: validatedData.finishedGoodId,
              locationId: body.locationId,
            },
          },
          select: { quantity: true },
        })
        currentStock = stock?.quantity || 0
      }
      
      // Calculate adjustment: newStock - currentStock
      adjustmentQuantity = validatedData.newStock - currentStock
      
      // Validate that adjustment doesn't result in negative stock
      // Since newStock >= 0 (validated by schema), adjustmentQuantity can be negative
      // but the final stock (currentStock + adjustmentQuantity = newStock) will be >= 0
      // So we only need to check if the adjustment itself is valid
      // The service layer will also validate this, but we check here for better error message
      if (adjustmentQuantity < 0 && currentStock + adjustmentQuantity < 0) {
        return NextResponse.json(
          { error: `Cannot adjust: would result in negative stock. Current: ${currentStock}, New: ${validatedData.newStock}` },
          { status: 400 }
        )
      }
    }

    // Convert to service input format (date is already Date from transform)
    const serviceInput: StockMovementInput = {
      type: validatedData.type,
      quantity: adjustmentQuantity!,
      date: validatedData.date,
      description: validatedData.description,
      rawMaterialId: validatedData.rawMaterialId || null,
      finishedGoodId: validatedData.finishedGoodId || null,
      batchId: null,
      locationId: body.locationId || null,
      drumId: validatedData.drumId || null,
    }

    // Create stock movement using service
    const result = await createStockMovement(serviceInput)

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    logger.error('Error creating stock movement:', error)

    if (error instanceof z.ZodError) {
      const firstError = error.errors[0]
      return NextResponse.json(
        { error: firstError.message || 'Validation failed' },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to create stock movement' },
      { status: 500 }
    )
  }
}
