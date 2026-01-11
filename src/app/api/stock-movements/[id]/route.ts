import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import {
  canEditStockMovements,
  canDeleteStockMovements,
  getPermissionErrorMessage,
} from '@/lib/rbac'
import { logger } from '@/lib/logger'
import {
  updateStockMovement,
  deleteStockMovement,
} from '@/lib/services'
import { updateStockMovementSchema } from '@/lib/validations'

/**
 * PUT /api/stock-movements/[id]
 *
 * Update individual stock movement
 *
 * @param request - NextRequest with update data in body
 * @param params - Route params with movement ID
 * @returns Updated stock movement
 *
 * @remarks
 * - Requires ADMIN role (canEditStockMovements)
 * - Validates input using updateStockMovementSchema
 * - Updates stock values and recalculates balances
 * - Prevents editing batch movements
 * - Validates date logic (OUT movements need sufficient stock)
 *
 * @throws 401 - Unauthorized (not logged in)
 * @throws 403 - Forbidden (not ADMIN)
 * @throws 400 - Validation error or business rule violation
 * @throws 404 - Movement not found
 */
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

    if (!canEditStockMovements(session.user.role)) {
      return NextResponse.json(
        {
          error: getPermissionErrorMessage(
            'edit stock movements',
            session.user.role
          ),
        },
        { status: 403 }
      )
    }

    const { id } = await params

    // Validate ID format
    const validatedId = z.string().cuid().parse(id)

    const body = await request.json()
    const validatedData = updateStockMovementSchema.parse(body)

    // Update stock movement using service
    const result = await updateStockMovement(validatedId, validatedData)

    return NextResponse.json(result)
  } catch (error) {
    logger.error('Error updating stock movement:', error)

    if (error instanceof z.ZodError) {
      const firstError = error.errors[0]
      return NextResponse.json(
        { error: firstError.message || 'Validation failed' },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      // Check for specific error types
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      if (error.message.includes('batch')) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      if (error.message.includes('Insufficient stock')) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to update stock movement' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/stock-movements/[id]
 *
 * Delete individual stock movement
 *
 * @param request - NextRequest
 * @param params - Route params with movement ID
 * @returns Success message
 *
 * @remarks
 * - Requires ADMIN role (canDeleteStockMovements)
 * - Reverses movement effect on stock values
 * - Prevents deleting batch movements
 * - Validates that deletion won't cause negative stock
 *
 * @throws 401 - Unauthorized (not logged in)
 * @throws 403 - Forbidden (not ADMIN)
 * @throws 400 - Business rule violation
 * @throws 404 - Movement not found
 */
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

    if (!canDeleteStockMovements(session.user.role)) {
      return NextResponse.json(
        {
          error: getPermissionErrorMessage(
            'delete stock movements',
            session.user.role
          ),
        },
        { status: 403 }
      )
    }

    const { id } = await params

    // Validate ID format
    const validatedId = z.string().cuid().parse(id)

    // Delete stock movement using service
    await deleteStockMovement(validatedId)

    return NextResponse.json({
      message: 'Stock movement deleted successfully',
    })
  } catch (error) {
    logger.error('Error deleting stock movement:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid movement ID format' },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      // Check for specific error types
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      if (error.message.includes('batch')) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      if (error.message.includes('negative stock')) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to delete stock movement' },
      { status: 500 }
    )
  }
}

