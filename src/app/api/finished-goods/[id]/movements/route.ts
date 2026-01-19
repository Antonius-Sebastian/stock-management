import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { getFinishedGoodMovements } from '@/lib/services'

/**
 * GET /api/finished-goods/[id]/movements
 *
 * Get finished good movements with running balance
 *
 * @param request - NextRequest with query params (locationId, limit)
 * @param params - Route params with finished good ID
 * @returns Finished good info and movements with running balance
 *
 * @remarks
 * - Requires authentication (all roles can view)
 * - Optional locationId query param to filter movements by location
 * - Optional limit query param (default 500, max to prevent performance issues)
 * - Movements sorted by date DESC (newest first)
 * - Running balance calculated working backwards from current stock
 *
 * @throws 401 - Unauthorized (not logged in)
 * @throws 400 - Invalid finished good ID format
 * @throws 404 - Finished good not found
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication required (all authenticated users can view movement history)
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Validate ID format to prevent SQL injection
    const validatedId = z.string().cuid().parse(id)

    // Parse query params
    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId') || undefined
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 500

    // Validate limit
    if (isNaN(limit) || limit < 1 || limit > 5000) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 5000' },
        { status: 400 }
      )
    }

    // Get finished good movements using service
    const result = await getFinishedGoodMovements(
      validatedId,
      locationId,
      limit
    )

    return NextResponse.json(result)
  } catch (error) {
    logger.error('Error fetching finished good movements:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid finished good ID format' },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      // Check if it's a "not found" error
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to fetch finished good movements' },
      { status: 500 }
    )
  }
}
