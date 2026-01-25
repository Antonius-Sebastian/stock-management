import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { getRawMaterialMovements } from '@/lib/services'

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

    // Parse pagination params from query string
    const { searchParams } = new URL(request.url)
    const pageParam = searchParams.get('page')
    const limitParam = searchParams.get('limit')

    const page = pageParam ? parseInt(pageParam, 10) : undefined
    const limit = limitParam ? parseInt(limitParam, 10) : undefined

    // Validate pagination params
    if (page !== undefined && (isNaN(page) || page < 1)) {
      return NextResponse.json(
        { error: 'Page must be a positive integer' },
        { status: 400 }
      )
    }

    if (limit !== undefined && (isNaN(limit) || limit < 1 || limit > 500)) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 500' },
        { status: 400 }
      )
    }

    // Get material movements using service
    const result = await getRawMaterialMovements(validatedId, {
      ...(page !== undefined && { page }),
      ...(limit !== undefined && { limit }),
    })

    return NextResponse.json(result)
  } catch (error) {
    logger.error('Error fetching material movements:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid material ID format' },
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
      { error: 'Failed to fetch material movements' },
      { status: 500 }
    )
  }
}
