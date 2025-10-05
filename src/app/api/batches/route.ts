import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { auth } from '@/auth'
import { canCreateBatches, getPermissionErrorMessage } from '@/lib/rbac'

const createBatchSchema = z.object({
  code: z.string().min(1, 'Batch code is required'),
  date: z.string().transform((str) => new Date(str)),
  description: z.string().optional(),
  finishedGoodId: z.string().min(1, 'Finished good is required'),
  materials: z.array(z.object({
    rawMaterialId: z.string().min(1, 'Raw material is required'),
    quantity: z.number().positive('Quantity must be positive'),
  })).min(1, 'At least one raw material is required'),
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

    const batchSelect = {
      id: true,
      code: true,
      date: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      finishedGood: {
        select: {
          id: true,
          name: true,
        },
      },
      batchUsages: {
        select: {
          id: true,
          quantity: true,
          rawMaterial: {
            select: {
              id: true,
              kode: true,
              name: true,
            },
          },
        },
      },
    }

    // If no pagination params, return all (backward compatible)
    if (!pageParam && !limitParam) {
      const batches = await prisma.batch.findMany({
        select: batchSelect,
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json(batches)
    }

    // Pagination mode
    const page = Math.max(1, parseInt(pageParam || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(limitParam || '50')))
    const skip = (page - 1) * limit

    // Get total count and paginated data in parallel
    const [batches, total] = await Promise.all([
      prisma.batch.findMany({
        skip,
        take: limit,
        select: batchSelect,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.batch.count(),
    ])

    // Return data with pagination metadata
    return NextResponse.json({
      data: batches,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + batches.length < total,
      },
    })
  } catch (error) {
    console.error('Error fetching batches:', error)
    return NextResponse.json(
      { error: 'Failed to fetch batches' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication and authorization required (ADMIN or FACTORY only)
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canCreateBatches(session.user.role)) {
      return NextResponse.json(
        { error: getPermissionErrorMessage('create batches', session.user.role) },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = createBatchSchema.parse(body)

    // Check for duplicate materials in the batch
    const materialIds = validatedData.materials.map(m => m.rawMaterialId)
    const uniqueMaterialIds = new Set(materialIds)
    if (materialIds.length !== uniqueMaterialIds.size) {
      return NextResponse.json(
        { error: 'Duplicate materials found in batch. Each material can only be used once per batch.' },
        { status: 400 }
      )
    }

    // Check for duplicate batch code
    const existingBatch = await prisma.batch.findFirst({
      where: { code: validatedData.code },
    })
    if (existingBatch) {
      return NextResponse.json(
        { error: `Batch code "${validatedData.code}" already exists` },
        { status: 400 }
      )
    }

    // Start a transaction to create batch, batch usages, and stock movements
    const result = await prisma.$transaction(async (tx) => {
      // Verify all raw materials exist and have sufficient stock
      // Use raw query with FOR UPDATE to lock rows and prevent race conditions
      for (const material of validatedData.materials) {
        const rawMaterials = await tx.$queryRaw<Array<{ id: string; name: string; currentStock: number }>>`
          SELECT id, name, "currentStock"
          FROM raw_materials
          WHERE id = ${material.rawMaterialId}
          FOR UPDATE
        `

        if (rawMaterials.length === 0) {
          throw new Error(`Raw material not found`)
        }

        const rawMaterial = rawMaterials[0]

        if (rawMaterial.currentStock < material.quantity) {
          throw new Error(`Insufficient stock for ${rawMaterial.name}. Available: ${rawMaterial.currentStock}, Required: ${material.quantity}`)
        }
      }

      // Create the batch
      const batch = await tx.batch.create({
        data: {
          code: validatedData.code,
          date: validatedData.date,
          description: validatedData.description,
          finishedGoodId: validatedData.finishedGoodId,
        },
      })

      // Process each raw material usage
      for (const material of validatedData.materials) {
        // Create batch usage
        await tx.batchUsage.create({
          data: {
            batchId: batch.id,
            rawMaterialId: material.rawMaterialId,
            quantity: material.quantity,
          },
        })

        // Create stock OUT movement for raw material
        await tx.stockMovement.create({
          data: {
            type: 'OUT',
            quantity: material.quantity,
            date: validatedData.date,
            description: `Batch production: ${validatedData.code}`,
            rawMaterialId: material.rawMaterialId,
            batchId: batch.id,
          },
        })

        // Update raw material current stock
        await tx.rawMaterial.update({
          where: { id: material.rawMaterialId },
          data: {
            currentStock: {
              decrement: material.quantity,
            },
          },
        })
      }

      // Note: Finished good stock will be updated manually through stock entry

      return batch
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error creating batch:', error)

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
      { error: 'Failed to create batch' },
      { status: 500 }
    )
  }
}