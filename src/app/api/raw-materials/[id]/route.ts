import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import {
  canManageMaterials,
  canDeleteMaterials,
  getPermissionErrorMessage,
} from '@/lib/rbac'
import { logger } from '@/lib/logger'
import { rawMaterialSchema } from '@/lib/validations'
import { updateRawMaterial, deleteRawMaterial } from '@/lib/services'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
            'edit raw materials',
            session.user.role
          ),
        },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = rawMaterialSchema.parse(body)

    // Update raw material using service
    const updatedMaterial = await updateRawMaterial(id, validatedData)

    return NextResponse.json(updatedMaterial)
  } catch (error) {
    logger.error('Error updating raw material:', error)

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
      { error: 'Failed to update raw material' },
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

    if (!canDeleteMaterials(session.user.role)) {
      return NextResponse.json(
        {
          error: getPermissionErrorMessage(
            'delete raw materials',
            session.user.role
          ),
        },
        { status: 403 }
      )
    }

    const { id } = await params

    // Delete raw material using service
    await deleteRawMaterial(id)

    return NextResponse.json({ message: 'Raw material deleted successfully' })
  } catch (error) {
    logger.error('Error deleting raw material:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to delete raw material' },
      { status: 500 }
    )
  }
}
