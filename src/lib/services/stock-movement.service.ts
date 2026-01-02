/**
 * Stock Movement Service
 *
 * Handles all database operations for stock movements
 * Separates business logic from API route handlers
 */

import { prisma } from '@/lib/db'
import { StockMovement } from '@prisma/client'
import {
  parseToWIB,
  startOfDayWIB,
  endOfDayWIB,
  toWIBISOString,
} from '@/lib/timezone'

/**
 * Stock movement input type for service layer
 * Includes ADJUSTMENT type support
 */
export interface StockMovementInput {
  type: 'IN' | 'OUT' | 'ADJUSTMENT'
  quantity: number
  date: Date
  description?: string | null
  rawMaterialId?: string | null
  finishedGoodId?: string | null
  batchId?: string | null
}

/**
 * Get stock movements by date and item
 *
 * @param itemId - Item ID (raw material or finished good)
 * @param itemType - Type of item ('raw-material' or 'finished-good')
 * @param date - Date to query movements for
 * @returns Array of stock movements for that date
 *
 * @remarks
 * - Uses WIB timezone for date range calculation
 * - Returns movements ordered by creation time (ascending)
 */
export async function getStockMovementsByDate(
  itemId: string,
  itemType: 'raw-material' | 'finished-good',
  date: Date
): Promise<StockMovement[]> {
  const queryDate = parseToWIB(toWIBISOString(date))
  const startOfDay = startOfDayWIB(queryDate)
  const endOfDay = endOfDayWIB(queryDate)

  return await prisma.stockMovement.findMany({
    where: {
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
      ...(itemType === 'raw-material'
        ? { rawMaterialId: itemId }
        : { finishedGoodId: itemId }),
    },
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * Create a stock movement and update current stock
 *
 * @param data - Stock movement input data (validated)
 * @returns Created stock movement
 * @throws {Error} If raw material not found
 * @throws {Error} If finished good not found
 * @throws {Error} If insufficient stock (for OUT or negative ADJUSTMENT)
 *
 * @remarks
 * - Uses transaction to ensure atomicity
 * - Uses FOR UPDATE locks for stock validation (OUT and negative ADJUSTMENT)
 * - Supports IN, OUT, and ADJUSTMENT types
 * - ADJUSTMENT can be positive or negative
 * - Stock update: IN adds, OUT subtracts, ADJUSTMENT uses direct quantity
 */
export async function createStockMovement(
  data: StockMovementInput
): Promise<StockMovement> {
  return await prisma.$transaction(async (tx) => {
    // Validate stock for OUT movements or negative ADJUSTMENT
    if (
      data.type === 'OUT' ||
      (data.type === 'ADJUSTMENT' && data.quantity < 0)
    ) {
      if (data.rawMaterialId) {
        const rawMaterials = await tx.$queryRaw<
          Array<{ id: string; name: string; currentStock: number }>
        >`
          SELECT id, name, "currentStock"
          FROM raw_materials
          WHERE id = ${data.rawMaterialId}
          FOR UPDATE
        `

        if (rawMaterials.length === 0) {
          throw new Error('Raw material not found')
        }

        const rawMaterial = rawMaterials[0]
        const quantityToCheck =
          data.type === 'ADJUSTMENT' ? Math.abs(data.quantity) : data.quantity

        if (rawMaterial.currentStock < quantityToCheck) {
          throw new Error(
            data.type === 'ADJUSTMENT'
              ? `Cannot adjust: would result in negative stock for ${rawMaterial.name}. Current: ${rawMaterial.currentStock}, Adjustment: ${data.quantity}`
              : `Insufficient stock for ${rawMaterial.name}. Available: ${rawMaterial.currentStock}, Requested: ${data.quantity}`
          )
        }
      }

      if (data.finishedGoodId) {
        const finishedGoods = await tx.$queryRaw<
          Array<{ id: string; name: string; currentStock: number }>
        >`
          SELECT id, name, "currentStock"
          FROM finished_goods
          WHERE id = ${data.finishedGoodId}
          FOR UPDATE
        `

        if (finishedGoods.length === 0) {
          throw new Error('Finished good not found')
        }

        const finishedGood = finishedGoods[0]
        const quantityToCheck =
          data.type === 'ADJUSTMENT' ? Math.abs(data.quantity) : data.quantity

        if (finishedGood.currentStock < quantityToCheck) {
          throw new Error(
            data.type === 'ADJUSTMENT'
              ? `Cannot adjust: would result in negative stock for ${finishedGood.name}. Current: ${finishedGood.currentStock}, Adjustment: ${data.quantity}`
              : `Insufficient stock for ${finishedGood.name}. Available: ${finishedGood.currentStock}, Requested: ${data.quantity}`
          )
        }
      }
    }

    // Create the stock movement
    const stockMovement = await tx.stockMovement.create({
      data,
    })

    // Calculate quantity change
    // ADJUSTMENT directly uses the quantity (can be positive or negative)
    // IN adds quantity, OUT subtracts quantity
    const quantityChange =
      data.type === 'ADJUSTMENT'
        ? data.quantity
        : data.type === 'IN'
          ? data.quantity
          : -data.quantity

    // Update current stock
    if (data.rawMaterialId) {
      await tx.rawMaterial.update({
        where: { id: data.rawMaterialId },
        data: {
          currentStock: {
            increment: quantityChange,
          },
        },
      })
    }

    if (data.finishedGoodId) {
      await tx.finishedGood.update({
        where: { id: data.finishedGoodId },
        data: {
          currentStock: {
            increment: quantityChange,
          },
        },
      })
    }

    return stockMovement
  })
}

/**
 * Delete stock movements by date and update stock
 *
 * @param itemId - Item ID (raw material or finished good)
 * @param itemType - Type of item ('raw-material' or 'finished-good')
 * @param date - Date to delete movements for
 * @param movementType - Type of movement to delete ('IN' or 'OUT')
 * @returns void
 * @throws {Error} If no movements found
 * @throws {Error} If item not found
 * @throws {Error} If restoring would cause negative stock
 *
 * @remarks
 * - Uses transaction to ensure atomicity
 * - Restores stock by reversing the movement effect
 * - Uses FOR UPDATE locks for stock validation
 */
export async function deleteStockMovementsByDate(
  itemId: string,
  itemType: 'raw-material' | 'finished-good',
  date: Date,
  movementType: 'IN' | 'OUT'
): Promise<void> {
  const queryDate = parseToWIB(toWIBISOString(date))
  const startOfDay = startOfDayWIB(queryDate)
  const endOfDay = endOfDayWIB(queryDate)

  await prisma.$transaction(async (tx) => {
    // Find movements to delete
    const movements = await tx.stockMovement.findMany({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        type: movementType,
        ...(itemType === 'raw-material'
          ? { rawMaterialId: itemId }
          : { finishedGoodId: itemId }),
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
        id: { in: movements.map((m) => m.id) },
      },
    })

    // Update current stock (reverse the movement)
    const stockChange = movementType === 'IN' ? -totalQuantity : totalQuantity

    // Check if stock will go negative
    if (itemType === 'raw-material') {
      const items = await tx.$queryRaw<
        Array<{ id: string; name: string; currentStock: number }>
      >`
        SELECT id, name, "currentStock"
        FROM raw_materials
        WHERE id = ${itemId}
        FOR UPDATE
      `

      if (items.length === 0) {
        throw new Error('Raw material not found')
      }

      const item = items[0]
      const newStock = item.currentStock + stockChange

      if (newStock < 0) {
        throw new Error(
          `Cannot delete movements: would result in negative stock for ${item.name} (${newStock.toFixed(2)})`
        )
      }

      await tx.rawMaterial.update({
        where: { id: itemId },
        data: {
          currentStock: {
            increment: stockChange,
          },
        },
      })
    } else {
      const items = await tx.$queryRaw<
        Array<{ id: string; name: string; currentStock: number }>
      >`
        SELECT id, name, "currentStock"
        FROM finished_goods
        WHERE id = ${itemId}
        FOR UPDATE
      `

      if (items.length === 0) {
        throw new Error('Finished good not found')
      }

      const item = items[0]
      const newStock = item.currentStock + stockChange

      if (newStock < 0) {
        throw new Error(
          `Cannot delete movements: would result in negative stock for ${item.name} (${newStock.toFixed(2)})`
        )
      }

      await tx.finishedGood.update({
        where: { id: itemId },
        data: {
          currentStock: {
            increment: stockChange,
          },
        },
      })
    }
  })
}

/**
 * Update stock movements by date and recalculate stock
 *
 * @param itemId - Item ID (raw material or finished good)
 * @param itemType - Type of item ('raw-material' or 'finished-good')
 * @param date - Date to update movements for
 * @param movementType - Type of movement ('IN' or 'OUT')
 * @param quantity - New quantity
 * @returns Update result with old total, new total, and difference
 * @throws {Error} If multiple movements exist (preserve audit trail)
 * @throws {Error} If item not found
 * @throws {Error} If update would cause negative stock
 *
 * @remarks
 * - Prevents editing if multiple movements exist (audit trail protection)
 * - Updates stock based on difference, not absolute value
 * - Uses FOR UPDATE locks for stock validation
 */
export async function updateStockMovementsByDate(
  itemId: string,
  itemType: 'raw-material' | 'finished-good',
  date: Date,
  movementType: 'IN' | 'OUT',
  quantity: number
): Promise<{ oldTotal: number; newTotal: number; difference: number }> {
  const queryDate = parseToWIB(toWIBISOString(date))
  const startOfDay = startOfDayWIB(queryDate)
  const endOfDay = endOfDayWIB(queryDate)

  return await prisma.$transaction(async (tx) => {
    // Find existing movements for this day and type
    const existingMovements = await tx.stockMovement.findMany({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        type: movementType,
        ...(itemType === 'raw-material'
          ? { rawMaterialId: itemId }
          : { finishedGoodId: itemId }),
      },
      include: {
        batch: {
          select: { code: true },
        },
      },
    })

    // Safety check: Prevent editing if multiple movements exist
    if (existingMovements.length > 1) {
      const movementDetails = existingMovements
        .map((m) =>
          m.batch
            ? `${m.quantity} (Batch: ${m.batch.code})`
            : `${m.quantity} (Manual)`
        )
        .join(', ')

      throw new Error(
        `Cannot edit: ${existingMovements.length} separate movements exist for this day (${movementDetails}). ` +
          `To preserve audit trail, please delete and recreate, or edit individual movements.`
      )
    }

    const oldTotal = existingMovements.reduce((sum, m) => sum + m.quantity, 0)
    const difference = quantity - oldTotal

    // If new quantity is 0, just delete existing movements
    if (quantity === 0) {
      if (existingMovements.length > 0) {
        await tx.stockMovement.deleteMany({
          where: { id: { in: existingMovements.map((m) => m.id) } },
        })
      }
    } else {
      // Delete all existing movements for this day
      if (existingMovements.length > 0) {
        await tx.stockMovement.deleteMany({
          where: { id: { in: existingMovements.map((m) => m.id) } },
        })
      }

      // Create a single new movement with the new quantity
      await tx.stockMovement.create({
        data: {
          type: movementType,
          quantity,
          date: startOfDay,
          description: `Updated via report (${movementType})`,
          ...(itemType === 'raw-material'
            ? { rawMaterialId: itemId }
            : { finishedGoodId: itemId }),
        },
      })
    }

    // Update current stock based on the difference
    const stockChange = movementType === 'IN' ? difference : -difference

    // Check if stock will go negative
    if (itemType === 'raw-material') {
      const items = await tx.$queryRaw<
        Array<{ id: string; name: string; currentStock: number }>
      >`
        SELECT id, name, "currentStock"
        FROM raw_materials
        WHERE id = ${itemId}
        FOR UPDATE
      `

      if (items.length === 0) {
        throw new Error('Raw material not found')
      }

      const item = items[0]
      const newStock = item.currentStock + stockChange

      if (newStock < 0) {
        throw new Error(
          `Cannot update movements: would result in negative stock for ${item.name} (${newStock.toFixed(2)})`
        )
      }

      await tx.rawMaterial.update({
        where: { id: itemId },
        data: {
          currentStock: {
            increment: stockChange,
          },
        },
      })
    } else {
      const items = await tx.$queryRaw<
        Array<{ id: string; name: string; currentStock: number }>
      >`
        SELECT id, name, "currentStock"
        FROM finished_goods
        WHERE id = ${itemId}
        FOR UPDATE
      `

      if (items.length === 0) {
        throw new Error('Finished good not found')
      }

      const item = items[0]
      const newStock = item.currentStock + stockChange

      if (newStock < 0) {
        throw new Error(
          `Cannot update movements: would result in negative stock for ${item.name} (${newStock.toFixed(2)})`
        )
      }

      await tx.finishedGood.update({
        where: { id: itemId },
        data: {
          currentStock: {
            increment: stockChange,
          },
        },
      })
    }

    return { oldTotal, newTotal: quantity, difference }
  })
}
