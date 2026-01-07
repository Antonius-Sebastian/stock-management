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

    // Parse limit from query params
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 500

    // Get material movements using service
    // Use limit to prevent fetching huge datasets
    const result = await getRawMaterialMovements(validatedId, limit)

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
