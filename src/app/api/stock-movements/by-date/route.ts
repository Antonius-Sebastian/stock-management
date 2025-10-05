import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { auth } from '@/auth'

const deleteByDateSchema = z.object({
  itemId: z.string().min(1),
  date: z.string(),
  itemType: z.enum(['raw-material', 'finished-good']),
  movementType: z.enum(['IN', 'OUT']),
})

const updateByDateSchema = z.object({
  itemId: z.string().min(1),
  date: z.string(),
  itemType: z.enum(['raw-material', 'finished-good']),
  movementType: z.enum(['IN', 'OUT']),
  quantity: z.number().min(0),
})

export async function DELETE(request: NextRequest) {
  try {
    // Authentication required (all authenticated users can edit report data)
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = {
      itemId: searchParams.get('itemId'),
      date: searchParams.get('date'),
      itemType: searchParams.get('itemType'),
      movementType: searchParams.get('movementType'),
    }

    const validatedQuery = deleteByDateSchema.parse(query)
    const queryDate = new Date(validatedQuery.date)

    // Get start and end of day (using UTC to avoid timezone issues)
    const startOfDay = new Date(queryDate)
    startOfDay.setUTCHours(0, 0, 0, 0)
    const endOfDay = new Date(queryDate)
    endOfDay.setUTCHours(23, 59, 59, 999)

    // Delete movements and update stock in a transaction
    await prisma.$transaction(async (tx) => {
      // Find movements to delete
      const movements = await tx.stockMovement.findMany({
        where: {
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
          type: validatedQuery.movementType,
          ...(validatedQuery.itemType === 'raw-material'
            ? { rawMaterialId: validatedQuery.itemId }
            : { finishedGoodId: validatedQuery.itemId }),
        },
      })

      if (movements.length === 0) {
        throw new Error('No movements found to delete')
      }

      // Calculate total quantity to restore
      const totalQuantity = movements.reduce((sum, m) => sum + m.quantity, 0)

      // Delete the movements
      await tx.stockMovement.deleteMany({
        where: {
          id: { in: movements.map(m => m.id) },
        },
      })

      // Update current stock (reverse the movement)
      const stockChange = validatedQuery.movementType === 'IN' ? -totalQuantity : totalQuantity

      // Check if stock will go negative
      if (validatedQuery.itemType === 'raw-material') {
        const item = await tx.rawMaterial.findUnique({
          where: { id: validatedQuery.itemId },
          select: { currentStock: true, name: true }
        })

        if (!item) {
          throw new Error('Raw material not found')
        }

        const newStock = item.currentStock + stockChange
        if (newStock < 0) {
          throw new Error(`Cannot delete movements: would result in negative stock for ${item.name} (${newStock.toFixed(2)})`)
        }

        await tx.rawMaterial.update({
          where: { id: validatedQuery.itemId },
          data: {
            currentStock: {
              increment: stockChange,
            },
          },
        })
      } else {
        const item = await tx.finishedGood.findUnique({
          where: { id: validatedQuery.itemId },
          select: { currentStock: true, name: true }
        })

        if (!item) {
          throw new Error('Finished good not found')
        }

        const newStock = item.currentStock + stockChange
        if (newStock < 0) {
          throw new Error(`Cannot delete movements: would result in negative stock for ${item.name} (${newStock.toFixed(2)})`)
        }

        await tx.finishedGood.update({
          where: { id: validatedQuery.itemId },
          data: {
            currentStock: {
              increment: stockChange,
            },
          },
        })
      }
    })

    return NextResponse.json({ message: 'Stock movements deleted successfully' })
  } catch (error) {
    console.error('Error deleting stock movements:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
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
      { error: 'Failed to delete stock movements' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Authentication required (all authenticated users can edit report data)
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = updateByDateSchema.parse(body)
    const queryDate = new Date(validatedData.date)

    // Get start and end of day (using UTC to avoid timezone issues)
    const startOfDay = new Date(queryDate)
    startOfDay.setUTCHours(0, 0, 0, 0)
    const endOfDay = new Date(queryDate)
    endOfDay.setUTCHours(23, 59, 59, 999)

    // Update/replace movements in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Find existing movements for this day and type
      const existingMovements = await tx.stockMovement.findMany({
        where: {
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
          type: validatedData.movementType,
          ...(validatedData.itemType === 'raw-material'
            ? { rawMaterialId: validatedData.itemId }
            : { finishedGoodId: validatedData.itemId }),
        },
      })

      const oldTotal = existingMovements.reduce((sum, m) => sum + m.quantity, 0)
      const difference = validatedData.quantity - oldTotal

      // If new quantity is 0, just delete existing movements
      if (validatedData.quantity === 0) {
        if (existingMovements.length > 0) {
          await tx.stockMovement.deleteMany({
            where: { id: { in: existingMovements.map(m => m.id) } },
          })
        }
      } else {
        // Delete all existing movements for this day
        if (existingMovements.length > 0) {
          await tx.stockMovement.deleteMany({
            where: { id: { in: existingMovements.map(m => m.id) } },
          })
        }

        // Create a single new movement with the new quantity
        await tx.stockMovement.create({
          data: {
            type: validatedData.movementType,
            quantity: validatedData.quantity,
            date: startOfDay,
            description: `Updated via report (${validatedData.movementType})`,
            ...(validatedData.itemType === 'raw-material'
              ? { rawMaterialId: validatedData.itemId }
              : { finishedGoodId: validatedData.itemId }),
          },
        })
      }

      // Update current stock based on the difference
      const stockChange = validatedData.movementType === 'IN' ? difference : -difference

      // Check if stock will go negative
      if (validatedData.itemType === 'raw-material') {
        const item = await tx.rawMaterial.findUnique({
          where: { id: validatedData.itemId },
          select: { currentStock: true, name: true }
        })

        if (!item) {
          throw new Error('Raw material not found')
        }

        const newStock = item.currentStock + stockChange
        if (newStock < 0) {
          throw new Error(`Cannot update movements: would result in negative stock for ${item.name} (${newStock.toFixed(2)})`)
        }

        await tx.rawMaterial.update({
          where: { id: validatedData.itemId },
          data: {
            currentStock: {
              increment: stockChange,
            },
          },
        })
      } else {
        const item = await tx.finishedGood.findUnique({
          where: { id: validatedData.itemId },
          select: { currentStock: true, name: true }
        })

        if (!item) {
          throw new Error('Finished good not found')
        }

        const newStock = item.currentStock + stockChange
        if (newStock < 0) {
          throw new Error(`Cannot update movements: would result in negative stock for ${item.name} (${newStock.toFixed(2)})`)
        }

        await tx.finishedGood.update({
          where: { id: validatedData.itemId },
          data: {
            currentStock: {
              increment: stockChange,
            },
          },
        })
      }

      return { oldTotal, newTotal: validatedData.quantity, difference }
    })

    return NextResponse.json({
      message: 'Stock movements updated successfully',
      result,
    })
  } catch (error) {
    console.error('Error updating stock movements:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
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
      { error: 'Failed to update stock movements' },
      { status: 500 }
    )
  }
}
