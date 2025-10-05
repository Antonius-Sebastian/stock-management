import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { auth } from '@/auth'
import { canManageMaterials, getPermissionErrorMessage } from '@/lib/rbac'

const updateRawMaterialSchema = z.object({
  kode: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  moq: z.number().min(1, 'MOQ must be at least 1'),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication and authorization required (ADMIN or OFFICE only)
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageMaterials(session.user.role)) {
      return NextResponse.json(
        { error: getPermissionErrorMessage('edit raw materials', session.user.role) },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateRawMaterialSchema.parse(body)

    // Check if raw material exists
    const existingMaterial = await prisma.rawMaterial.findUnique({
      where: { id },
    })

    if (!existingMaterial) {
      return NextResponse.json(
        { error: 'Raw material not found' },
        { status: 404 }
      )
    }

    // Check for duplicate code (excluding current material)
    const duplicateCode = await prisma.rawMaterial.findFirst({
      where: {
        kode: validatedData.kode,
        id: { not: id },
      },
    })

    if (duplicateCode) {
      return NextResponse.json(
        { error: `Material code "${validatedData.kode}" already exists` },
        { status: 400 }
      )
    }

    const updatedMaterial = await prisma.rawMaterial.update({
      where: { id },
      data: validatedData,
    })

    return NextResponse.json(updatedMaterial)
  } catch (error) {
    console.error('Error updating raw material:', error)

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
    // Authentication and authorization required (ADMIN or OFFICE only)
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageMaterials(session.user.role)) {
      return NextResponse.json(
        { error: getPermissionErrorMessage('delete raw materials', session.user.role) },
        { status: 403 }
      )
    }

    const { id } = await params

    // Check if raw material exists
    const existingMaterial = await prisma.rawMaterial.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            stockMovements: true,
            batchUsages: true,
          },
        },
      },
    })

    if (!existingMaterial) {
      return NextResponse.json(
        { error: 'Raw material not found' },
        { status: 404 }
      )
    }

    // Check if material has been used
    if (existingMaterial._count.stockMovements > 0 || existingMaterial._count.batchUsages > 0) {
      return NextResponse.json(
        { error: 'Cannot delete raw material that has stock movements or has been used in batches' },
        { status: 400 }
      )
    }

    await prisma.rawMaterial.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Raw material deleted successfully' })
  } catch (error) {
    console.error('Error deleting raw material:', error)

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to delete raw material' },
      { status: 500 }
    )
  }
}
