import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { canManageUsers, getPermissionErrorMessage } from '@/lib/rbac'
import { logger } from '@/lib/logger'
import { AuditHelpers, getIpAddress } from '@/lib/audit'
import {
  getUserById,
  updateUser,
  deleteUser,
  UpdateUserInput,
} from '@/lib/services'
import { updateUserSchema } from '@/lib/validations'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication and authorization required (ADMIN only)
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageUsers(session.user.role)) {
      return NextResponse.json(
        { error: getPermissionErrorMessage('view users', session.user.role) },
        { status: 403 }
      )
    }

    const { id } = await params

    // Get user using service
    const user = await getUserById(id)

    return NextResponse.json(user)
  } catch (error) {
    logger.error('Error fetching user:', error)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication and authorization required (ADMIN only)
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageUsers(session.user.role)) {
      return NextResponse.json(
        { error: getPermissionErrorMessage('edit users', session.user.role) },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateUserSchema.parse(body) as UpdateUserInput

    // Update user using service
    const user = await updateUser(id, validatedData)

    return NextResponse.json(user)
  } catch (error) {
    logger.error('Error updating user:', error)

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
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication and authorization required (ADMIN only)
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageUsers(session.user.role)) {
      return NextResponse.json(
        { error: getPermissionErrorMessage('delete users', session.user.role) },
        { status: 403 }
      )
    }

    const { id } = await params

    // Get user info for audit log before deletion
    const existingUser = await getUserById(id)

    // Delete user using service (includes self-deletion and last-admin checks)
    await deleteUser(id, session.user.id)

    // Audit log
    await AuditHelpers.userDeleted(
      existingUser.id,
      existingUser.username,
      {
        id: session.user.id,
        name: session.user.name || session.user.username,
        role: session.user.role,
      },
      getIpAddress(request.headers)
    )

    return NextResponse.json({ message: 'User deleted successfully' })
  } catch (error) {
    logger.error('Error deleting user:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}
