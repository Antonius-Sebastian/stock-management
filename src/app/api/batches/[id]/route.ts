import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { logger } from '@/lib/logger'
import { AuditHelpers } from '@/lib/audit'
import {
  canEditBatches,
  canDeleteBatches,
  getPermissionErrorMessage,
} from '@/lib/rbac'
import {
  getBatchById,
  updateBatch,
  deleteBatch,
  BatchInput,
} from '@/lib/services'
import { batchSchemaAPI } from '@/lib/validations'

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

    // Get batch using service
    const batch = await getBatchById(id)

    return NextResponse.json(batch)
  } catch (error) {
    logger.error('Error fetching batch:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
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
    const validatedData = batchSchemaAPI.parse(body)

    // Convert to service input format
    const batchInput: BatchInput = {
      code: validatedData.code,
      date: validatedData.date,
      description: validatedData.description || null,
      materials: validatedData.materials,
    }

    // Update batch using service
    const updatedBatch = await updateBatch(id, batchInput)

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
      return NextResponse.json({ error: error.message }, { status: 400 })
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
        {
          error: getPermissionErrorMessage('delete batches', session.user.role),
        },
        { status: 403 }
      )
    }

    const { id } = await params

    // Get batch info for audit log before deletion
    const existingBatch = await getBatchById(id)

    // Delete batch using service (includes stock restoration)
    await deleteBatch(id)

    // Audit log
    await AuditHelpers.batchDeleted(existingBatch.code, '', {
      id: session.user.id,
      name: session.user.name || session.user.username,
      role: session.user.role,
    })

    return NextResponse.json({
      message: 'Batch deleted successfully and stock restored',
    })
  } catch (error) {
    logger.error('Error deleting batch:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to delete batch' },
      { status: 500 }
    )
  }
}
