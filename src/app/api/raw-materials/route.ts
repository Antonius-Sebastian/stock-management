import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { logger } from '@/lib/logger'
import { canManageMaterials, getPermissionErrorMessage } from '@/lib/rbac'
import { rawMaterialSchema } from '@/lib/validations'
import { getRawMaterials, createRawMaterial } from '@/lib/services'

export async function GET(request: NextRequest) {
  try {
    // Authentication required (all roles can view)
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse pagination parameters (optional - defaults to all)
    const { searchParams } = new URL(request.url)
    const pageParam = searchParams.get('page')
    const limitParam = searchParams.get('limit')

    // Prepare pagination options
    const options =
      pageParam || limitParam
        ? {
            page: pageParam ? parseInt(pageParam) : undefined,
            limit: limitParam ? parseInt(limitParam) : undefined,
            includeDrums: searchParams.get('include') === 'drums',
          }
        : { includeDrums: searchParams.get('include') === 'drums' }

    // Get raw materials using service
    const result = await getRawMaterials(options)

    return NextResponse.json(result)
  } catch (error) {
    logger.error('Error fetching raw materials:', error)
    return NextResponse.json(
      { error: 'Failed to fetch raw materials' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication and authorization required (ADMIN, OFFICE_PURCHASING, or OFFICE_WAREHOUSE)
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageMaterials(session.user.role)) {
      return NextResponse.json(
        {
          error: getPermissionErrorMessage(
            'create raw materials',
            session.user.role
          ),
        },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = rawMaterialSchema.parse(body)

    // Create raw material using service
    const rawMaterial = await createRawMaterial(validatedData)

    return NextResponse.json(rawMaterial, { status: 201 })
  } catch (error) {
    logger.error('Error creating raw material:', error)

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
      { error: 'Failed to create raw material' },
      { status: 500 }
    )
  }
}
