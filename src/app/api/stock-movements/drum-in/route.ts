import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { canCreateStockMovement } from '@/lib/rbac'
import { logger } from '@/lib/logger'
import { createDrumStockIn, DrumStockInInput } from '@/lib/services'
import { drumStockInSchema } from '@/lib/validations'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    // Parse date string back to Date object for schema validation
    const dataWithDate = {
      ...body,
      date: new Date(body.date),
    }

    const validatedData = drumStockInSchema.parse(dataWithDate)

    // Check permission
    if (!canCreateStockMovement(session.user.role, 'raw-material', 'IN')) {
      return NextResponse.json(
        { error: 'Insufficient permissions to create stock movement' },
        { status: 403 }
      )
    }

    const serviceInput: DrumStockInInput = {
      rawMaterialId: validatedData.rawMaterialId,
      date: validatedData.date,
      description: validatedData.description,
      drums: validatedData.drums,
    }

    await createDrumStockIn(serviceInput)

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    logger.error('Error creating drum stock in:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to create stock movement' },
      { status: 500 }
    )
  }
}
