import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { canManageUsers, getPermissionErrorMessage } from '@/lib/rbac'
import { logger } from '@/lib/logger'
import { AuditHelpers, getIpAddress } from '@/lib/audit'
import { createUserSchema } from '@/lib/validations'
import { getUsers, createUser } from '@/lib/services'
import {
  checkRateLimit,
  RateLimits,
  createRateLimitHeaders,
} from '@/lib/rate-limit'

export async function GET() {
  try {
    // Authentication and authorization required (ADMIN only)
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageUsers(session.user.role)) {
      return NextResponse.json(
        { error: getPermissionErrorMessage('manage users', session.user.role) },
        { status: 403 }
      )
    }

    // Get users using service
    const users = await getUsers()

    return NextResponse.json(users)
  } catch (error) {
    logger.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/users
 *
 * Create a new user
 *
 * @param request - NextRequest with user data in body
 * @returns Created user (password excluded)
 *
 * @remarks
 * - Requires ADMIN role
 * - Validates password complexity (8+ chars, uppercase, lowercase, number)
 * - Hashes password with bcrypt
 * - Prevents duplicate usernames
 * - Logs audit trail
 *
 * @throws 401 - Unauthorized (not logged in)
 * @throws 403 - Forbidden (not ADMIN)
 * @throws 400 - Validation error or duplicate username
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication and authorization required (ADMIN only)
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageUsers(session.user.role)) {
      return NextResponse.json(
        { error: getPermissionErrorMessage('create users', session.user.role) },
        { status: 403 }
      )
    }

    const ip = getIpAddress(request.headers) || 'unknown'
    const rateLimit = await checkRateLimit(ip, RateLimits.USER_CREATION)

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many user creation attempts. Please try again later.' },
        {
          status: 429,
          headers: createRateLimitHeaders(rateLimit),
        }
      )
    }

    const body = await request.json()
    const validatedData = createUserSchema.parse(body)

    // Create user using service
    const user = await createUser(validatedData)

    // Audit log
    await AuditHelpers.userCreated(
      user.id,
      user.username,
      {
        id: session.user.id,
        name: session.user.name || session.user.username,
        role: session.user.role,
      },
      getIpAddress(request.headers)
    )

    return NextResponse.json(user)
  } catch (error) {
    logger.error('Error creating user:', error)

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
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
