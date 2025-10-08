import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { z } from 'zod'
import { logger } from '@/lib/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication required (all authenticated users can view movement history)
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Validate ID format to prevent SQL injection
    const validatedId = z.string().cuid().parse(id)

    // Fetch the raw material
    const material = await prisma.rawMaterial.findUnique({
      where: { id: validatedId },
      select: {
        id: true,
        kode: true,
        name: true,
        currentStock: true,
        moq: true,
      },
    })

    if (!material) {
      return NextResponse.json(
        { error: 'Raw material not found' },
        { status: 404 }
      )
    }

    // Fetch all stock movements for this material
    const movements = await prisma.stockMovement.findMany({
      where: {
        rawMaterialId: validatedId,
      },
      include: {
        batch: {
          select: {
            id: true,
            code: true,
          },
        },
      },
      orderBy: {
        date: 'asc', // Start from oldest to calculate running balance
      },
    })

    // Calculate running balance for each movement
    // Start from 0 and work forward through all movements in chronological order
    let runningBalance = 0
    const movementsWithBalance = movements.map((movement) => {
      // Apply this movement
      if (movement.type === 'IN') {
        runningBalance += movement.quantity
      } else {
        runningBalance -= movement.quantity
      }

      return {
        id: movement.id,
        type: movement.type,
        quantity: movement.quantity,
        date: movement.date,
        description: movement.description,
        batch: movement.batch,
        runningBalance: Math.round(runningBalance * 100) / 100, // Round to 2 decimal places
        createdAt: movement.createdAt,
      }
    })

    // Reverse to show newest first
    movementsWithBalance.reverse()

    return NextResponse.json({
      material,
      movements: movementsWithBalance,
    })
  } catch (error) {
    logger.error('Error fetching material movements:', error)
    return NextResponse.json(
      { error: 'Failed to fetch material movements' },
      { status: 500 }
    )
  }
}
