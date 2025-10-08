import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { auth } from '@/auth'
import { canManageFinishedGoods, canDeleteFinishedGoods, getPermissionErrorMessage } from '@/lib/rbac'
import { logger } from '@/lib/logger'

const updateFinishedGoodSchema = z.object({
  name: z.string().min(1, 'Name is required'),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication and authorization required (ADMIN or OFFICE only)
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageFinishedGoods(session.user.role)) {
      return NextResponse.json(
        { error: getPermissionErrorMessage('edit finished goods', session.user.role) },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateFinishedGoodSchema.parse(body)

    // Check if finished good exists
    const existingProduct = await prisma.finishedGood.findUnique({
      where: { id },
    })

    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Finished good not found' },
        { status: 404 }
      )
    }

    // Check for duplicate name (excluding current product)
    const duplicateProduct = await prisma.finishedGood.findFirst({
      where: {
        name: validatedData.name,
        id: { not: id },
      },
    })

    if (duplicateProduct) {
      return NextResponse.json(
        { error: `Product "${validatedData.name}" already exists` },
        { status: 400 }
      )
    }

    const updatedProduct = await prisma.finishedGood.update({
      where: { id },
      data: validatedData,
    })

    return NextResponse.json(updatedProduct)
  } catch (error) {
    logger.error('Error updating finished good:', error)

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
      { error: 'Failed to update finished good' },
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

    if (!canDeleteFinishedGoods(session.user.role)) {
      return NextResponse.json(
        { error: getPermissionErrorMessage('delete finished goods', session.user.role) },
        { status: 403 }
      )
    }

    const { id } = await params

    // Check if finished good exists
    const existingProduct = await prisma.finishedGood.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            stockMovements: true,
            batches: true,
          },
        },
      },
    })

    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Finished good not found' },
        { status: 404 }
      )
    }

    // Check if product has been used
    if (existingProduct._count.stockMovements > 0 || existingProduct._count.batches > 0) {
      return NextResponse.json(
        { error: 'Cannot delete finished good that has stock movements or has been produced in batches' },
        { status: 400 }
      )
    }

    await prisma.finishedGood.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Finished good deleted successfully' })
  } catch (error) {
    logger.error('Error deleting finished good:', error)

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to delete finished good' },
      { status: 500 }
    )
  }
}
