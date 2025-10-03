import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createRawMaterialSchema = z.object({
  kode: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  currentStock: z.number().min(0, 'Stock cannot be negative'),
  moq: z.number().min(1, 'MOQ must be at least 1'),
})

export async function GET() {
  try {
    const rawMaterials = await prisma.rawMaterial.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(rawMaterials)
  } catch (error) {
    console.error('Error fetching raw materials:', error)
    return NextResponse.json(
      { error: 'Failed to fetch raw materials' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
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
      data: validatedData,
    })

    return NextResponse.json(rawMaterial, { status: 201 })
  } catch (error) {
    console.error('Error creating raw material:', error)

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