import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

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

export async function POST(request: NextRequest) {
  try {
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