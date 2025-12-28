import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { auth } from '@/auth'
import { logger } from '@/lib/logger'
import { AuditHelpers } from '@/lib/audit'
import { canEditBatches, canDeleteBatches, getPermissionErrorMessage } from '@/lib/rbac'
import { parseToWIB } from '@/lib/timezone'

const updateBatchSchema = z.object({
  code: z.string().min(1, 'Batch code is required'),
  date: z.string().transform((str) => parseToWIB(new Date(str))),
  description: z.string().optional(),
  finishedGoods: z.array(
    z.object({
      finishedGoodId: z.string().min(1, 'Finished good is required'),
      quantity: z.number().positive('Quantity must be positive'),
    })
  ).min(1, 'At least one finished good is required'),
  materials: z.array(
    z.object({
      rawMaterialId: z.string().min(1, 'Raw material is required'),
      quantity: z.number().positive('Quantity must be positive'),
    })
  ).min(1, 'At least one raw material is required'),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication required (all roles can view)
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const batch = await prisma.batch.findUnique({
      where: { id },
      include: {
        batchFinishedGoods: {
          include: {
            finishedGood: true,
          },
        },
        batchUsages: {
          include: {
            rawMaterial: true,
          },
        },
      },
    })

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(batch)
  } catch (error) {
    logger.error('Error fetching batch:', error)

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch batch' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication and authorization required (ADMIN only)
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canEditBatches(session.user.role)) {
      return NextResponse.json(
        { error: getPermissionErrorMessage('edit batches', session.user.role) },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateBatchSchema.parse(body)

    // Check for duplicate finished goods
    const finishedGoodIds = validatedData.finishedGoods.map(fg => fg.finishedGoodId)
    const uniqueFinishedGoodIds = new Set(finishedGoodIds)
    if (finishedGoodIds.length !== uniqueFinishedGoodIds.size) {
      return NextResponse.json(
        { error: 'Duplicate finished goods found in batch. Each finished good can only be used once per batch.' },
        { status: 400 }
      )
    }

    // Check for duplicate materials
    const materialIds = validatedData.materials.map(m => m.rawMaterialId)
    const uniqueMaterialIds = new Set(materialIds)
    if (materialIds.length !== uniqueMaterialIds.size) {
      return NextResponse.json(
        { error: 'Duplicate materials found in batch. Each material can only be used once per batch.' },
        { status: 400 }
      )
    }

    // Check if batch exists
    const existingBatch = await prisma.batch.findUnique({
      where: { id },
      include: {
        batchUsages: true,
        batchFinishedGoods: true,
      },
    })

    if (!existingBatch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      )
    }

    // Check for duplicate code (excluding current batch)
    const duplicateCode = await prisma.batch.findFirst({
      where: {
        code: validatedData.code,
        id: { not: id },
      },
    })

    if (duplicateCode) {
      return NextResponse.json(
        { error: `Batch code "${validatedData.code}" already exists` },
        { status: 400 }
      )
    }

    // Handle batch updates in a transaction
    const updatedBatch = await prisma.$transaction(async (tx) => {
      // Step 1: Restore stock for all old finished goods
      for (const oldFinishedGood of existingBatch.batchFinishedGoods) {
        await tx.finishedGood.update({
          where: { id: oldFinishedGood.finishedGoodId },
          data: {
            currentStock: {
              decrement: oldFinishedGood.quantity,
            },
          },
        })

        // Delete old finished good IN stock movements
        await tx.stockMovement.deleteMany({
          where: {
            batchId: id,
            finishedGoodId: oldFinishedGood.finishedGoodId,
            type: 'IN',
          },
        })
      }

      // Step 2: Delete all old batch finished goods
      await tx.batchFinishedGood.deleteMany({
        where: { batchId: id },
      })

      // Step 3: Restore stock for all old materials
      for (const oldUsage of existingBatch.batchUsages) {
        await tx.rawMaterial.update({
          where: { id: oldUsage.rawMaterialId },
          data: {
            currentStock: {
              increment: oldUsage.quantity,
            },
          },
        })

        // Delete old stock movement
        await tx.stockMovement.deleteMany({
          where: {
            batchId: id,
            rawMaterialId: oldUsage.rawMaterialId,
          },
        })
      }

      // Step 4: Delete all old batch usages
      await tx.batchUsage.deleteMany({
        where: { batchId: id },
      })

      // Step 5: Create new finished goods and add stock
      for (const finishedGood of validatedData.finishedGoods) {
        // Verify finished good exists with row locking for consistency
        const finishedGoods = await tx.$queryRaw<
          Array<{ id: string; name: string; currentStock: number }>
        >`
          SELECT id, name, "currentStock"
          FROM finished_goods
          WHERE id = ${finishedGood.finishedGoodId}
          FOR UPDATE
        `

        if (finishedGoods.length === 0) {
          throw new Error(`Finished good not found: ${finishedGood.finishedGoodId}`)
        }

        const fg = finishedGoods[0]

        // Create batch finished good record
        await tx.batchFinishedGood.create({
          data: {
            batchId: id,
            finishedGoodId: finishedGood.finishedGoodId,
            quantity: finishedGood.quantity,
          },
        })

        // Create stock IN movement for finished good
        await tx.stockMovement.create({
          data: {
            type: 'IN',
            quantity: finishedGood.quantity,
            date: validatedData.date,
            description: `Batch ${validatedData.code} production`,
            finishedGoodId: finishedGood.finishedGoodId,
            batchId: id,
          },
        })

        // Update finished good current stock
        await tx.finishedGood.update({
          where: { id: finishedGood.finishedGoodId },
          data: {
            currentStock: {
              increment: finishedGood.quantity,
            },
          },
        })
      }

      // Step 6: Create new batch usages and deduct stock
      for (const material of validatedData.materials) {
        // Check if raw material has enough stock with row locking
        const rawMaterials = await tx.$queryRaw<
          Array<{ id: string; name: string; currentStock: number }>
        >`
          SELECT id, name, "currentStock"
          FROM raw_materials
          WHERE id = ${material.rawMaterialId}
          FOR UPDATE
        `

        if (rawMaterials.length === 0) {
          throw new Error(`Raw material not found: ${material.rawMaterialId}`)
        }

        const rawMaterial = rawMaterials[0]

        if (rawMaterial.currentStock < material.quantity) {
          throw new Error(
            `Insufficient stock for ${rawMaterial.name}. Available: ${rawMaterial.currentStock}, Required: ${material.quantity}`
          )
        }

        // Create batch usage
        await tx.batchUsage.create({
          data: {
            batchId: id,
            rawMaterialId: material.rawMaterialId,
            quantity: material.quantity,
          },
        })

        // Deduct stock
        await tx.rawMaterial.update({
          where: { id: material.rawMaterialId },
          data: {
            currentStock: {
              decrement: material.quantity,
            },
          },
        })

        // Create stock movement (OUT)
        await tx.stockMovement.create({
          data: {
            type: 'OUT',
            quantity: material.quantity,
            date: validatedData.date,
            rawMaterialId: material.rawMaterialId,
            batchId: id,
            description: `Batch ${validatedData.code} production`,
          },
        })
      }

      // Update batch info
      return await tx.batch.update({
        where: { id },
        data: {
          code: validatedData.code,
          date: validatedData.date,
          description: validatedData.description,
        },
        include: {
          batchFinishedGoods: {
            include: {
              finishedGood: true,
            },
          },
          batchUsages: {
            include: {
              rawMaterial: true,
            },
          },
        },
      })
    })

    return NextResponse.json(updatedBatch)
  } catch (error) {
    logger.error('Error updating batch:', error)

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
      { error: 'Failed to update batch' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication and authorization required (ADMIN only)
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canDeleteBatches(session.user.role)) {
      return NextResponse.json(
        { error: getPermissionErrorMessage('delete batches', session.user.role) },
        { status: 403 }
      )
    }

    const { id } = await params

    // Check if batch exists with its usages and finished goods
    const existingBatch = await prisma.batch.findUnique({
      where: { id },
      include: {
        batchUsages: true,
        batchFinishedGoods: true,
      },
    })

    if (!existingBatch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      )
    }

    // Delete batch, its usages, finished goods, and stock movements in a transaction
    // This will restore the stock and clean up all related records
    await prisma.$transaction(async (tx) => {
      // Restore finished good stock
      for (const batchFinishedGood of existingBatch.batchFinishedGoods) {
        await tx.finishedGood.update({
          where: { id: batchFinishedGood.finishedGoodId },
          data: {
            currentStock: {
              decrement: batchFinishedGood.quantity,
            },
          },
        })
      }

      // Restore raw material stock
      for (const batchUsage of existingBatch.batchUsages) {
        await tx.rawMaterial.update({
          where: { id: batchUsage.rawMaterialId },
          data: {
            currentStock: {
              increment: batchUsage.quantity,
            },
          },
        })
      }

      // Delete stock movements associated with this batch FIRST
      // This prevents orphaned movements with NULL batchId
      await tx.stockMovement.deleteMany({
        where: { batchId: id },
      })

      // Delete all batch finished goods
      await tx.batchFinishedGood.deleteMany({
        where: { batchId: id },
      })

      // Delete all batch usages
      await tx.batchUsage.deleteMany({
        where: { batchId: id },
      })

      // Delete the batch
      await tx.batch.delete({
        where: { id },
      })
    })

    // Audit log (using existingBatch since batch is deleted)
    const finishedGoods = await Promise.all(
      existingBatch.batchFinishedGoods.map(async (bfg) => {
        const finishedGood = await prisma.finishedGood.findUnique({
          where: { id: bfg.finishedGoodId },
          select: { name: true },
        })
        return finishedGood?.name || 'Unknown'
      })
    )

    await AuditHelpers.batchDeleted(
      existingBatch.code,
      finishedGoods.join(', '),
      {
        id: session.user.id,
        name: session.user.name || session.user.username,
        role: session.user.role,
      }
    )

    return NextResponse.json({ message: 'Batch deleted successfully and stock restored' })
  } catch (error) {
    logger.error('Error deleting batch:', error)

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to delete batch' },
      { status: 500 }
    )
  }
}
