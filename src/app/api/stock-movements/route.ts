import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { auth } from '@/auth'
import { canCreateStockMovement, canCreateStockAdjustment, getPermissionErrorMessage } from '@/lib/rbac'
import { logger } from '@/lib/logger'
import { parseToWIB, startOfDayWIB, endOfDayWIB } from '@/lib/timezone'

const createStockMovementSchema = z.object({
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  quantity: z.number().refine(
    (val) => val !== 0,
    { message: 'Quantity cannot be zero' }
  ).refine(
    (val, ctx) => {
      // IN and OUT must be positive, ADJUSTMENT can be positive or negative
      if (ctx.parent.type === 'ADJUSTMENT') return true
      return val > 0
    },
    { message: 'Quantity must be positive for IN and OUT movements' }
  ),
  date: z.string().transform((str) => parseToWIB(new Date(str))),
  description: z.string().optional(),
  rawMaterialId: z.string().optional(),
  finishedGoodId: z.string().optional(),
}).refine(
  (data) => data.rawMaterialId || data.finishedGoodId,
  { message: "Either rawMaterialId or finishedGoodId must be provided" }
)

const queryStockMovementSchema = z.object({
  itemId: z.string().min(1),
  date: z.string(),
  itemType: z.enum(['raw-material', 'finished-good']),
})

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

    const validatedQuery = queryStockMovementSchema.parse(query)
    const queryDate = parseToWIB(new Date(validatedQuery.date))

    // Get start and end of day in WIB
    const startOfDay = startOfDayWIB(queryDate)
    const endOfDay = endOfDayWIB(queryDate)

    // Query movements for this item on this day
    const movements = await prisma.stockMovement.findMany({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        ...(validatedQuery.itemType === 'raw-material'
          ? { rawMaterialId: validatedQuery.itemId }
          : { finishedGoodId: validatedQuery.itemId }),
      },
      orderBy: { createdAt: 'asc' },
    })

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
    const validatedData = createStockMovementSchema.parse(body)

    // Determine item type for permission check
    const itemType = validatedData.rawMaterialId ? 'raw-material' : 'finished-good'

    // Check permission - ADJUSTMENT uses separate permission check
    if (validatedData.type === 'ADJUSTMENT') {
      if (!canCreateStockAdjustment(session.user.role)) {
        return NextResponse.json(
          { error: getPermissionErrorMessage('create stock adjustments', session.user.role) },
          { status: 403 }
        )
      }
    } else {
      // Check granular permission based on item type and movement type
      if (!canCreateStockMovement(session.user.role, itemType, validatedData.type)) {
        const restriction = itemType === 'raw-material' && validatedData.type === 'OUT'
          ? 'Raw material OUT movements can only be created by ADMIN (normally created via batch production)'
          : getPermissionErrorMessage(`create ${validatedData.type} movements for ${itemType}s`, session.user.role)

        return NextResponse.json(
          { error: restriction },
          { status: 403 }
        )
      }
    }

    // Start a transaction to update both stock movement and current stock
    const result = await prisma.$transaction(async (tx) => {
      // Check if stock will go negative for OUT movements or negative ADJUSTMENT
      // Use SELECT FOR UPDATE to lock rows and prevent race conditions
      if (validatedData.type === 'OUT' || (validatedData.type === 'ADJUSTMENT' && validatedData.quantity < 0)) {
        if (validatedData.rawMaterialId) {
          // Lock the row with FOR UPDATE
          const rawMaterials = await tx.$queryRaw<Array<{ id: string; name: string; currentStock: number }>>`
            SELECT id, name, "currentStock"
            FROM raw_materials
            WHERE id = ${validatedData.rawMaterialId}
            FOR UPDATE
          `

          if (rawMaterials.length === 0) {
            throw new Error('Raw material not found')
          }

          const rawMaterial = rawMaterials[0]
          const quantityToCheck = validatedData.type === 'ADJUSTMENT' 
            ? Math.abs(validatedData.quantity) 
            : validatedData.quantity

          if (rawMaterial.currentStock < quantityToCheck) {
            throw new Error(
              validatedData.type === 'ADJUSTMENT'
                ? `Cannot adjust: would result in negative stock for ${rawMaterial.name}. Current: ${rawMaterial.currentStock}, Adjustment: ${validatedData.quantity}`
                : `Insufficient stock for ${rawMaterial.name}. Available: ${rawMaterial.currentStock}, Requested: ${validatedData.quantity}`
            )
          }
        }

        if (validatedData.finishedGoodId) {
          // Lock the row with FOR UPDATE
          const finishedGoods = await tx.$queryRaw<Array<{ id: string; name: string; currentStock: number }>>`
            SELECT id, name, "currentStock"
            FROM finished_goods
            WHERE id = ${validatedData.finishedGoodId}
            FOR UPDATE
          `

          if (finishedGoods.length === 0) {
            throw new Error('Finished good not found')
          }

          const finishedGood = finishedGoods[0]
          const quantityToCheck = validatedData.type === 'ADJUSTMENT' 
            ? Math.abs(validatedData.quantity) 
            : validatedData.quantity

          if (finishedGood.currentStock < quantityToCheck) {
            throw new Error(
              validatedData.type === 'ADJUSTMENT'
                ? `Cannot adjust: would result in negative stock for ${finishedGood.name}. Current: ${finishedGood.currentStock}, Adjustment: ${validatedData.quantity}`
                : `Insufficient stock for ${finishedGood.name}. Available: ${finishedGood.currentStock}, Requested: ${validatedData.quantity}`
            )
          }
        }
      }

      // Create the stock movement
      const stockMovement = await tx.stockMovement.create({
        data: validatedData,
      })

      // Update current stock
      // ADJUSTMENT directly uses the quantity (can be positive or negative)
      // IN adds quantity, OUT subtracts quantity
      const quantityChange = validatedData.type === 'ADJUSTMENT'
        ? validatedData.quantity
        : validatedData.type === 'IN'
        ? validatedData.quantity
        : -validatedData.quantity

      if (validatedData.rawMaterialId) {
        await tx.rawMaterial.update({
          where: { id: validatedData.rawMaterialId },
          data: {
            currentStock: {
              increment: quantityChange
            }
          }
        })
      }

      if (validatedData.finishedGoodId) {
        await tx.finishedGood.update({
          where: { id: validatedData.finishedGoodId },
          data: {
            currentStock: {
              increment: quantityChange
            }
          }
        })
      }

      return stockMovement
    })

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
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create stock movement' },
      { status: 500 }
    )
  }
}