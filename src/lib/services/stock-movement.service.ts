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
  drumId?: string | null
  locationId?: string | null
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

export async function createStockMovement(
  data: StockMovementInput
): Promise<StockMovement> {
  return await prisma.$transaction(async (tx) => {
    // Validate stock for OUT movements or negative ADJUSTMENT
    if (
      data.type === 'OUT' ||
      (data.type === 'ADJUSTMENT' && data.quantity < 0)
    ) {
      if (data.drumId) {
        // ... drum logic (unchanged) ...
        const drum = await tx.drum.findUnique({
          where: { id: data.drumId },
        })

        if (!drum) {
          throw new Error('Drum not found')
        }

        const quantityToCheck =
          data.type === 'ADJUSTMENT' ? Math.abs(data.quantity) : data.quantity

        if (drum.currentQuantity < quantityToCheck) {
          throw new Error(
            `Insufficient stock in drum ${drum.label}. Available: ${drum.currentQuantity}, Requested: ${data.quantity}`
          )
        }
      }

      // For raw materials, if drumId is provided, skip aggregate stock validation
      // (drum stock validation is sufficient)
      if (data.rawMaterialId && !data.drumId) {
        // Only validate aggregate stock if no drumId is provided
        // (This should not happen for raw materials now, but kept for safety)
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
        // LOCATION AWARE LOGIC
        if (!data.locationId) {
          // Fallback for legacy calls? Or strict?
          // Strict for now per requirements.
          throw new Error(
            'Location is required for Finished Good transactions.'
          )
        }

        const finishedGoodStocks = await tx.finishedGoodStock.findUnique({
          where: {
            finishedGoodId_locationId: {
              finishedGoodId: data.finishedGoodId,
              locationId: data.locationId,
            },
          },
        })

        // Also fetch the global good to get the Name for error messages
        const finishedGoodInfo = await tx.finishedGood.findUnique({
          where: { id: data.finishedGoodId },
          select: { name: true },
        })

        const currentStock = finishedGoodStocks?.quantity || 0
        const quantityToCheck =
          data.type === 'ADJUSTMENT' ? Math.abs(data.quantity) : data.quantity

        if (currentStock < quantityToCheck) {
          throw new Error(
            data.type === 'ADJUSTMENT'
              ? `Cannot adjust: would result in negative stock for ${finishedGoodInfo?.name} at location. Current: ${currentStock}, Adjustment: ${data.quantity}`
              : `Insufficient stock for ${finishedGoodInfo?.name} at location. Available: ${currentStock}, Requested: ${data.quantity}`
          )
        }
      }
    }

    // Create the stock movement
    const stockMovement = await tx.stockMovement.create({
      data,
    })

    // Calculate quantity change
    const quantityChange =
      data.type === 'ADJUSTMENT'
        ? data.quantity
        : data.type === 'IN'
          ? data.quantity
          : -data.quantity

    // Update Drum Stock (Raw Material)
    if (data.drumId) {
      // ... existing drum update ...
      const drum = await tx.drum.findUnique({
        where: { id: data.drumId },
        select: { currentQuantity: true },
      })
      if (!drum) throw new Error('Drum not found')
      const newQuantity = drum.currentQuantity + quantityChange
      await tx.drum.update({
        where: { id: data.drumId },
        data: {
          currentQuantity: { increment: quantityChange },
          isActive: { set: newQuantity > 0 },
        },
      })
    }

    // Update Raw Material Global Stock
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

    // Update Finished Good Stock (Location Aware)
    if (data.finishedGoodId) {
      if (!data.locationId) throw new Error('Location required')

      // Update upsert: Create if not exists (for IN), update if exists
      await tx.finishedGoodStock.upsert({
        where: {
          finishedGoodId_locationId: {
            finishedGoodId: data.finishedGoodId,
            locationId: data.locationId,
          },
        },
        update: {
          quantity: { increment: quantityChange },
        },
        create: {
          finishedGoodId: data.finishedGoodId,
          locationId: data.locationId,
          // If this is OUT/ADJUSTMENT negative, it should have been caught by validation above
          // So safe to assume if creating, it's positive or 0-base
          quantity: quantityChange < 0 ? 0 : quantityChange, // Should ideally be quantityChange
        },
      })

      // Update Global Aggregate (Keep it in sync)
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

export interface DrumStockInInput {
  rawMaterialId: string
  date: Date
  description?: string
  drums: Array<{ label: string; quantity: number }>
}

/**
 * Create stock in with multiple drums
 *
 * @param input - Drum stock in input
 * @returns boolean
 */
export async function createDrumStockIn(
  input: DrumStockInInput
): Promise<void> {
  const { rawMaterialId, date, description, drums } = input

  await prisma.$transaction(async (tx) => {
    // Check for duplicate drum labels
    for (const drum of drums) {
      const existing = await tx.drum.findFirst({
        where: {
          rawMaterialId,
          label: drum.label,
        },
      })
      if (existing) {
        throw new Error(
          `Drum ID ${drum.label} already exists for this material`
        )
      }
    }

    // Process each drum
    for (const drum of drums) {
      // Create Drum
      const newDrum = await tx.drum.create({
        data: {
          label: drum.label,
          currentQuantity: drum.quantity,
          rawMaterialId,
          isActive: true,
          createdAt: date,
        },
      })

      // Create Movement tied to Drum
      await tx.stockMovement.create({
        data: {
          type: 'IN',
          quantity: drum.quantity,
          date,
          description: description || 'Stock In (Drum)',
          rawMaterialId,
          drumId: newDrum.id,
        },
      })
    }

    // Update Raw Material Total Stock
    const totalQuantity = drums.reduce((sum, d) => sum + d.quantity, 0)
    await tx.rawMaterial.update({
      where: { id: rawMaterialId },
      data: {
        currentStock: {
          increment: totalQuantity,
        },
      },
    })
  })
}
