import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { auth } from '@/auth'
import { logger } from '@/lib/logger'
import { canManageMaterials, getPermissionErrorMessage } from '@/lib/rbac'

const createRawMaterialSchema = z.object({
  kode: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  moq: z.number().min(1, 'MOQ must be at least 1'),
})

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

    // If no pagination params, return all (backward compatible)
    if (!pageParam && !limitParam) {
      const rawMaterials = await prisma.rawMaterial.findMany({
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json(rawMaterials)
    }

    // Pagination mode
    const page = Math.max(1, parseInt(pageParam || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(limitParam || '50')))
    const skip = (page - 1) * limit

    // Get total count and paginated data in parallel
    const [rawMaterials, total] = await Promise.all([
      prisma.rawMaterial.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.rawMaterial.count(),
    ])

    // Return data with pagination metadata
    return NextResponse.json({
      data: rawMaterials,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + rawMaterials.length < total,
      },
    })
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
    // Authentication and authorization required (ADMIN or OFFICE only)
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageMaterials(session.user.role)) {
      return NextResponse.json(
        { error: getPermissionErrorMessage('create raw materials', session.user.role) },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = createRawMaterialSchema.parse(body)

    // Check for duplicate code
    const existingMaterial = await prisma.rawMaterial.findFirst({
      where: { kode: validatedData.kode },
    })
    if (existingMaterial) {
      return NextResponse.json(
        { error: `Material code "${validatedData.kode}" already exists` },
        { status: 400 }
      )
    }

    const rawMaterial = await prisma.rawMaterial.create({
      data: {
        ...validatedData,
        currentStock: 0, // Always start with 0 stock
      },
    })

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
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create raw material' },
      { status: 500 }
    )
  }
}