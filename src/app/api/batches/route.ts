import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createBatchSchema = z.object({
  code: z.string().min(1, 'Batch code is required'),
  date: z.string().transform((str) => new Date(str)),
  description: z.string().optional(),
  finishedGoodId: z.string().min(1, 'Finished good is required'),
  materials: z.array(z.object({
    rawMaterialId: z.string().min(1, 'Raw material is required'),
    quantity: z.number().positive('Quantity must be positive'),
  })).min(1, 'At least one raw material is required'),
})

export async function GET() {
  try {
    const batches = await prisma.batch.findMany({
      include: {
        finishedGood: true,
        batchUsages: {
          include: {
            rawMaterial: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(batches)
  } catch (error) {
    console.error('Error fetching batches:', error)
    return NextResponse.json(
      { error: 'Failed to fetch batches' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createBatchSchema.parse(body)

    // Check for duplicate batch code
    const existingBatch = await prisma.batch.findFirst({
      where: { code: validatedData.code },
    })
    if (existingBatch) {
      return NextResponse.json(
        { error: `Batch code "${validatedData.code}" already exists` },
        { status: 400 }
      )
    }

    // Start a transaction to create batch, batch usages, and stock movements
    const result = await prisma.$transaction(async (tx) => {
      // Verify all raw materials exist and have sufficient stock
      for (const material of validatedData.materials) {
        const rawMaterial = await tx.rawMaterial.findUnique({
          where: { id: material.rawMaterialId },
        })

        if (!rawMaterial) {
          throw new Error(`Raw material not found`)
        }

        if (rawMaterial.currentStock < material.quantity) {
          throw new Error(`Insufficient stock for ${rawMaterial.name}. Available: ${rawMaterial.currentStock}, Required: ${material.quantity}`)
        }
      }

      // Create the batch
      const batch = await tx.batch.create({
        data: {
          code: validatedData.code,
          date: validatedData.date,
          description: validatedData.description,
          finishedGoodId: validatedData.finishedGoodId,
        },
      })

      // Process each raw material usage
      for (const material of validatedData.materials) {
        // Create batch usage
        await tx.batchUsage.create({
          data: {
            batchId: batch.id,
            rawMaterialId: material.rawMaterialId,
            quantity: material.quantity,
          },
        })

        // Create stock OUT movement for raw material
        await tx.stockMovement.create({
          data: {
            type: 'OUT',
            quantity: material.quantity,
            date: validatedData.date,
            description: `Batch production: ${validatedData.code}`,
            rawMaterialId: material.rawMaterialId,
            batchId: batch.id,
          },
        })

        // Update raw material current stock
        await tx.rawMaterial.update({
          where: { id: material.rawMaterialId },
          data: {
            currentStock: {
              decrement: material.quantity,
            },
          },
        })
      }

      // Note: Finished good stock will be updated manually through stock entry

      return batch
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error creating batch:', error)

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
      { error: 'Failed to create batch' },
      { status: 500 }
    )
  }
}