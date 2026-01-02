import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { logger } from '@/lib/logger'
import {
  canDeleteStockMovements,
  canEditStockMovements,
  getPermissionErrorMessage,
} from '@/lib/rbac'
import { parseToWIB } from '@/lib/timezone'
import {
  deleteStockMovementsByDate,
  updateStockMovementsByDate,
} from '@/lib/services'
import {
  stockMovementByDateDeleteSchema,
  stockMovementByDateUpdateSchema,
} from '@/lib/validations'

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const query = {
      itemId: searchParams.get('itemId'),
      date: searchParams.get('date'),
      itemType: searchParams.get('itemType'),
      movementType: searchParams.get('movementType'),
    }

    const validatedQuery = stockMovementByDateDeleteSchema.parse(query)
    const queryDate = parseToWIB(validatedQuery.date)

    // Delete stock movements using service
    await deleteStockMovementsByDate(
      validatedQuery.itemId,
      validatedQuery.itemType,
      queryDate,
      validatedQuery.movementType
    )

    return NextResponse.json({
      message: 'Stock movements deleted successfully',
    })
  } catch (error) {
    logger.error('Error deleting stock movements:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to delete stock movements' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
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

    const body = await request.json()
    const validatedData = stockMovementByDateUpdateSchema.parse(body)
    const queryDate = parseToWIB(validatedData.date)

    // Update stock movements using service
    const result = await updateStockMovementsByDate(
      validatedData.itemId,
      validatedData.itemType,
      queryDate,
      validatedData.movementType,
      validatedData.quantity
    )

    return NextResponse.json({
      message: 'Stock movements updated successfully',
      result,
    })
  } catch (error) {
    logger.error('Error updating stock movements:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to update stock movements' },
      { status: 500 }
    )
  }
}
