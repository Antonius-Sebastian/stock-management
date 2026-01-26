import { NextRequest, NextResponse } from 'next/server'
import { updateLocation, deleteLocation } from '@/lib/services/location.service'
import { z } from 'zod'
import { auth } from '@/auth'
import {
  canManageLocations,
  canDeleteLocations,
  getPermissionErrorMessage,
} from '@/lib/rbac'

const updateLocationSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  address: z.string().optional(),
  isDefault: z.boolean().optional(),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageLocations(session.user.role)) {
      return NextResponse.json(
        { error: getPermissionErrorMessage('manage locations', session.user.role) },
        { status: 403 }
      )
    }

    const json = await req.json()
    const body = updateLocationSchema.parse(json)
    const { id } = await params

    const location = await updateLocation(id, body)
    return NextResponse.json(location)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canDeleteLocations(session.user.role)) {
      return NextResponse.json(
        { error: getPermissionErrorMessage('delete locations', session.user.role) },
        { status: 403 }
      )
    }

    const { id } = await params
    await deleteLocation(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
