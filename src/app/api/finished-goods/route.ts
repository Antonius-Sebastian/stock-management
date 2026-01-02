import { NextRequest } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { successResponse, ErrorResponses } from '@/lib/api-response'
import { logger } from '@/lib/logger'
import { canManageFinishedGoods, getPermissionErrorMessage } from '@/lib/rbac'
import { finishedGoodSchema } from '@/lib/validations'
import { getFinishedGoods, createFinishedGood } from '@/lib/services'

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

    // Prepare pagination options
    const options =
      pageParam || limitParam
        ? {
            page: pageParam ? parseInt(pageParam) : undefined,
            limit: limitParam ? parseInt(limitParam) : undefined,
          }
        : undefined

    // Get finished goods using service
    const result = await getFinishedGoods(options)

    return successResponse(result)
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

    if (!canManageFinishedGoods(session.user.role)) {
      return ErrorResponses.forbidden(
        getPermissionErrorMessage('create finished goods', session.user.role)
      )
    }

    const body = await request.json()
    const validatedData = finishedGoodSchema.parse(body)

    // Create finished good using service
    const finishedGood = await createFinishedGood(validatedData)

    return successResponse(finishedGood, 201)
  } catch (error) {
    logger.error('Error creating finished good:', error)

    if (error instanceof z.ZodError) {
      const firstError = error.errors[0]
      return ErrorResponses.badRequest(
        firstError.message || 'Validation failed'
      )
    }

    if (error instanceof Error) {
      return ErrorResponses.badRequest(error.message)
    }

    return ErrorResponses.internalError()
  }
}
