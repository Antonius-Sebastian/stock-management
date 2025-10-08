import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { auth } from '@/auth'
import { successResponse, ErrorResponses } from '@/lib/api-response'
import { logger } from '@/lib/logger'

const createFinishedGoodSchema = z.object({
  name: z.string().min(1, 'Name is required'),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return ErrorResponses.unauthorized()
    }

    // Parse pagination parameters (optional - defaults to all)
    const { searchParams } = new URL(request.url)
    const pageParam = searchParams.get('page')
    const limitParam = searchParams.get('limit')

    // If no pagination params, return all (backward compatible)
    if (!pageParam && !limitParam) {
      const finishedGoods = await prisma.finishedGood.findMany({
        orderBy: { createdAt: 'desc' },
      })
      return successResponse(finishedGoods)
    }

    // Pagination mode
    const page = Math.max(1, parseInt(pageParam || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(limitParam || '50')))
    const skip = (page - 1) * limit

    // Get total count and paginated data in parallel
    const [finishedGoods, total] = await Promise.all([
      prisma.finishedGood.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.finishedGood.count(),
    ])

    // Return data with pagination metadata
    return successResponse({
      data: finishedGoods,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + finishedGoods.length < total,
      },
    })
  } catch (error) {
    logger.error('Error fetching finished goods:', error)
    return ErrorResponses.internalError()
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return ErrorResponses.unauthorized()
    }

    const body = await request.json()
    const validatedData = createFinishedGoodSchema.parse(body)

    // Check for duplicate name
    const existingProduct = await prisma.finishedGood.findFirst({
      where: { name: validatedData.name },
    })
    if (existingProduct) {
      return ErrorResponses.badRequest(`Product "${validatedData.name}" already exists`)
    }

    const finishedGood = await prisma.finishedGood.create({
      data: {
        ...validatedData,
        currentStock: 0, // Always start with 0 stock
      },
    })

    return successResponse(finishedGood, 201)
  } catch (error) {
    logger.error('Error creating finished good:', error)

    if (error instanceof z.ZodError) {
      const firstError = error.errors[0]
      return ErrorResponses.badRequest(firstError.message || 'Validation failed')
    }

    if (error instanceof Error) {
      return ErrorResponses.badRequest(error.message)
    }

    return ErrorResponses.internalError()
  }
}