import { NextRequest, NextResponse } from 'next/server'
import { getLocations, createLocation } from '@/lib/services/location.service'
import { z } from 'zod'
import { auth } from '@/auth'
import { canManageLocations, getPermissionErrorMessage } from '@/lib/rbac'

const locationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().optional(),
  isDefault: z.boolean().optional(),
})

export async function GET() {
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

    const locations = await getLocations()
    return NextResponse.json(locations)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch locations' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
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
    const body = locationSchema.parse(json)

    const location = await createLocation(body)
    return NextResponse.json(location, { status: 201 })
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
