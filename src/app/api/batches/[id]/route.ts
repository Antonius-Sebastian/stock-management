import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { auth } from '@/auth'
import { canEditBatches, canDeleteBatches, getPermissionErrorMessage } from '@/lib/rbac'

const updateBatchSchema = z.object({
  code: z.string().min(1, 'Batch code is required'),
  date: z.string().datetime(),
  description: z.string().optional(),
  finishedGoodId: z.string().min(1, 'Finished good is required'),
  // Note: Material usage cannot be updated after batch creation
  // to maintain data integrity. Delete and recreate the batch instead.
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
        finishedGood: true,
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
    console.error('Error fetching batch:', error)

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
    // Authentication and authorization required (ADMIN or FACTORY only)
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

    // Check if batch exists
    const existingBatch = await prisma.batch.findUnique({
      where: { id },
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

    const updatedBatch = await prisma.batch.update({
      where: { id },
      data: {
        code: validatedData.code,
        date: new Date(validatedData.date),
        description: validatedData.description,
        finishedGoodId: validatedData.finishedGoodId,
      },
      include: {
        finishedGood: true,
        batchUsages: {
          include: {
            rawMaterial: true,
          },
        },
      },
    })

    return NextResponse.json(updatedBatch)
  } catch (error) {
    console.error('Error updating batch:', error)

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

    // Check if batch exists with its usages
    const existingBatch = await prisma.batch.findUnique({
      where: { id },
      include: {
        batchUsages: true,
      },
    })

    if (!existingBatch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      )
    }

    // Delete batch, its usages, and stock movements in a transaction
    // This will restore the stock and clean up all related records
    await prisma.$transaction(async (tx) => {
      // Delete stock movements associated with this batch FIRST
      // This prevents orphaned movements with NULL batchId
      await tx.stockMovement.deleteMany({
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

      // Restore stock for all raw materials that were used
      for (const usage of existingBatch.batchUsages) {
        await tx.rawMaterial.update({
          where: { id: usage.rawMaterialId },
          data: {
            currentStock: {
              increment: usage.quantity,
            },
          },
        })
      }
    })

    return NextResponse.json({ message: 'Batch deleted successfully and stock restored' })
  } catch (error) {
    console.error('Error deleting batch:', error)

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
