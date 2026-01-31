import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { canCreateStockMovement } from '@/lib/rbac'
import { logger } from '@/lib/logger'
import { createDrumStockIn, DrumStockInInput } from '@/lib/services'
import { drumStockInSchema } from '@/lib/validations'

// Debug logging helper
function debugLog(location: string, message: string, data: unknown) {
  const logEntry = {
    location,
    message,
    data,
    timestamp: Date.now(),
    sessionId: 'debug-session',
    runId: 'phase1',
    hypothesisId: 'D',
  }
  fetch('http://127.0.0.1:7242/ingest/d8baa842-95ab-4bfd-967a-af7151fa0e4e', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(logEntry),
  }).catch(() => {})
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // #region agent log
    debugLog('drum-in/route.ts:17', 'drum-in API ENTRY', {
      originalDateString: body.date,
      rawMaterialId: body.rawMaterialId,
      drumsCount: body.drums?.length,
    })
    // #endregion

    // Parse date string back to Date object for schema validation
    const dataWithDate = {
      ...body,
      date: new Date(body.date),
    }

    const validatedData = drumStockInSchema.parse(dataWithDate)

    // #region agent log
    debugLog('drum-in/route.ts:24', 'drum-in validated data', {
      parsedDate: validatedData.date.toISOString(),
      rawMaterialId: validatedData.rawMaterialId,
      drums: validatedData.drums,
    })
    // #endregion

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

    // #region agent log
    debugLog('drum-in/route.ts:40', 'drum-in BEFORE createDrumStockIn', {
      serviceInputDate: serviceInput.date.toISOString(),
      rawMaterialId: serviceInput.rawMaterialId,
      drumsCount: serviceInput.drums.length,
    })
    // #endregion

    await createDrumStockIn(serviceInput)

    // #region agent log
    debugLog('drum-in/route.ts:50', 'drum-in AFTER createDrumStockIn', {
      success: true,
    })
    // #endregion

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
