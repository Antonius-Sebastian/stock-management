import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import {
  canManageFinishedGoods,
  canDeleteFinishedGoods,
  getPermissionErrorMessage,
} from '@/lib/rbac'
import { logger } from '@/lib/logger'
import { finishedGoodSchema } from '@/lib/validations'
import { updateFinishedGood, deleteFinishedGood } from '@/lib/services'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication and authorization required (ADMIN, OFFICE_PURCHASING, or OFFICE_WAREHOUSE)
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageFinishedGoods(session.user.role)) {
      return NextResponse.json(
        {
          error: getPermissionErrorMessage(
            'edit finished goods',
            session.user.role
          ),
        },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = finishedGoodSchema.parse(body)

    // Update finished good using service
    const updatedProduct = await updateFinishedGood(id, validatedData)

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
      return NextResponse.json({ error: error.message }, { status: 400 })
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
        {
          error: getPermissionErrorMessage(
            'delete finished goods',
            session.user.role
          ),
        },
        { status: 403 }
      )
    }

    const { id } = await params

    // Delete finished good using service
    await deleteFinishedGood(id)

    return NextResponse.json({ message: 'Finished good deleted successfully' })
  } catch (error) {
    logger.error('Error deleting finished good:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to delete finished good' },
      { status: 500 }
    )
  }
}
