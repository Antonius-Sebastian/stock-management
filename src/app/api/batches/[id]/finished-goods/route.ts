import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { logger } from '@/lib/logger'
import {
  canAddFinishedGoodsToBatch,
  getPermissionErrorMessage,
} from '@/lib/rbac'
import { getBatchById } from '@/lib/services'
import { prisma } from '@/lib/db'
import { addFinishedGoodsSchema } from '@/lib/validations'

/**
 * POST /api/batches/[id]/finished-goods
 *
 * Add finished goods to an existing batch
 *
 * @param request - NextRequest with finished goods data in body
 * @param params - Route params with batch id
 * @returns Success message with added finished goods
 *
 * @remarks
 * - Requires ADMIN or FACTORY role
 * - Batch must exist
 * - Batch must not already have finished goods (can only add once)
 * - All finished goods must exist
 * - No duplicate finished goods in the request
 * - Automatically updates batch status to COMPLETED
 * - Creates stock IN movements and updates finished good stock
 *
 * @throws 401 - Unauthorized (not logged in)
 * @throws 403 - Forbidden (insufficient permissions)
 * @throws 400 - Validation error or batch already has finished goods
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication and authorization required (ADMIN or FACTORY only)
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canAddFinishedGoodsToBatch(session.user.role)) {
      return NextResponse.json(
        {
          error: getPermissionErrorMessage(
            'add finished goods to batch',
            session.user.role
          ),
        },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = addFinishedGoodsSchema.parse(body)

    // Get existing batch
    const batch = await getBatchById(id)

    // Check if batch already has finished goods (can only add once)
    if (batch.batchFinishedGoods && batch.batchFinishedGoods.length > 0) {
      return NextResponse.json(
        {
          error:
            'Batch already has finished goods. Finished goods can only be added once per batch.',
        },
        { status: 400 }
      )
    }

    // Transaction: Add finished goods
    const result = await prisma.$transaction(async (tx) => {
      const addedFinishedGoods = []

      for (const fg of validatedData.finishedGoods) {
        // Verify finished good exists
        const finishedGood = await tx.finishedGood.findUnique({
          where: { id: fg.finishedGoodId },
        })

        if (!finishedGood) {
          throw new Error(`Finished good not found: ${fg.finishedGoodId}`)
        }

        // Create batch finished good record
        await tx.batchFinishedGood.create({
          data: {
            batchId: id,
            finishedGoodId: fg.finishedGoodId,
            quantity: fg.quantity,
          },
        })

        // Create stock IN movement for finished good
        await tx.stockMovement.create({
          data: {
            type: 'IN',
            quantity: fg.quantity,
            date: batch.date,
            description: `Batch production: ${batch.code}`,
            finishedGoodId: fg.finishedGoodId,
            batchId: id,
          },
        })

        // Update finished good current stock
        await tx.finishedGood.update({
          where: { id: fg.finishedGoodId },
          data: {
            currentStock: {
              increment: fg.quantity,
            },
          },
        })

        addedFinishedGoods.push({
          finishedGoodId: fg.finishedGoodId,
          quantity: fg.quantity,
          name: finishedGood.name,
        })
      }

      // Update batch status to COMPLETED
      await tx.batch.update({
        where: { id },
        data: { status: 'COMPLETED' },
      })

      return addedFinishedGoods
    })

    return NextResponse.json({
      message: 'Finished goods added successfully',
      addedFinishedGoods: result,
    })
  } catch (error) {
    logger.error('Error adding finished goods to batch:', error)

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
      { error: 'Failed to add finished goods to batch' },
      { status: 500 }
    )
  }
}

