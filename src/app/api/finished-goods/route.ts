import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createFinishedGoodSchema = z.object({
  name: z.string().min(1, 'Name is required'),
})

export async function GET() {
  try {
    const finishedGoods = await prisma.finishedGood.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(finishedGoods)
  } catch (error) {
    console.error('Error fetching finished goods:', error)
    return NextResponse.json(
      { error: 'Failed to fetch finished goods' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createFinishedGoodSchema.parse(body)

    // Check for duplicate name
    const existingProduct = await prisma.finishedGood.findFirst({
      where: { name: validatedData.name },
    })
    if (existingProduct) {
      return NextResponse.json(
        { error: `Product "${validatedData.name}" already exists` },
        { status: 400 }
      )
    }

    const finishedGood = await prisma.finishedGood.create({
      data: validatedData,
    })

    return NextResponse.json(finishedGood, { status: 201 })
  } catch (error) {
    console.error('Error creating finished good:', error)

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
      { error: 'Failed to create finished good' },
      { status: 500 }
    )
  }
}