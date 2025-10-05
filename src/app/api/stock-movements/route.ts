import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { auth } from '@/auth'
import { canCreateStockEntries, getPermissionErrorMessage } from '@/lib/rbac'

const createStockMovementSchema = z.object({
  type: z.enum(['IN', 'OUT']),
  quantity: z.number().positive('Quantity must be positive'),
  date: z.string().transform((str) => new Date(str)),
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
    const queryDate = new Date(validatedQuery.date)

    // Get start and end of day
    const startOfDay = new Date(queryDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(queryDate)
    endOfDay.setHours(23, 59, 59, 999)

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
    console.error('Error querying stock movements:', error)

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
    // Authentication and authorization required (all authenticated users can create stock entries)
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canCreateStockEntries(session.user.role)) {
      return NextResponse.json(
        { error: getPermissionErrorMessage('create stock entries', session.user.role) },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = createStockMovementSchema.parse(body)

    // Start a transaction to update both stock movement and current stock
    const result = await prisma.$transaction(async (tx) => {
      // Check if stock will go negative for OUT movements
      if (validatedData.type === 'OUT') {
        if (validatedData.rawMaterialId) {
          const rawMaterial = await tx.rawMaterial.findUnique({
            where: { id: validatedData.rawMaterialId },
          })
          if (!rawMaterial) {
            throw new Error('Raw material not found')
          }
          if (rawMaterial.currentStock < validatedData.quantity) {
            throw new Error(`Insufficient stock. Available: ${rawMaterial.currentStock}, Requested: ${validatedData.quantity}`)
          }
        }

        if (validatedData.finishedGoodId) {
          const finishedGood = await tx.finishedGood.findUnique({
            where: { id: validatedData.finishedGoodId },
          })
          if (!finishedGood) {
            throw new Error('Finished good not found')
          }
          if (finishedGood.currentStock < validatedData.quantity) {
            throw new Error(`Insufficient stock. Available: ${finishedGood.currentStock}, Requested: ${validatedData.quantity}`)
          }
        }
      }

      // Create the stock movement
      const stockMovement = await tx.stockMovement.create({
        data: validatedData,
      })

      // Update current stock
      const quantityChange = validatedData.type === 'IN'
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
    console.error('Error creating stock movement:', error)

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