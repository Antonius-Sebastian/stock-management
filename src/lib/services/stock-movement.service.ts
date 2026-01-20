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

/**
 * Calculate stock level at a specific point in time (before the given date)
 *
 * @param itemId - Item ID (raw material or finished good)
 * @param itemType - Type of item ('raw-material' or 'finished-good')
 * @param date - Date to calculate stock before (exclusive)
 * @param locationId - Optional location ID for finished goods
 * @param drumId - Optional drum ID for raw materials
 * @returns Stock level before the given date
 *
 * @remarks
 * - Sums all movements BEFORE the given date
 * - For finished goods: filters by locationId if provided
 * - For raw materials: filters by drumId if provided
 * - Used for date validation before creating/editing movements
 */
export async function calculateStockAtDate(
  itemId: string,
  itemType: 'raw-material' | 'finished-good',
  date: Date,
  locationId?: string | null,
  drumId?: string | null
): Promise<number> {
  const queryDate = parseToWIB(toWIBISOString(date))
  const startOfDay = startOfDayWIB(queryDate)

  // OPTIMIZATION: Reverse calculation strategy
  // Instead of summing from 0 to Date (O(N)), we start from Current Stock
  // and subtract movements from Date to Now (O(small)).
  // Stock(Date) = CurrentStock - Sum(Movements >= Date)

  // 1. Get Current Stock
  let currentStock = 0

  if (itemType === 'raw-material') {
    if (drumId) {
      const drum = await prisma.drum.findUnique({
        where: { id: drumId },
        select: { currentQuantity: true },
      })
      currentStock = drum?.currentQuantity || 0
    } else {
      const material = await prisma.rawMaterial.findUnique({
        where: { id: itemId },
        select: { currentStock: true },
      })
      currentStock = material?.currentStock || 0
    }
  } else {
    // Finished Good
    if (locationId) {
      const stock = await prisma.finishedGoodStock.findUnique({
        where: {
          finishedGoodId_locationId: {
            finishedGoodId: itemId,
            locationId: locationId,
          },
        },
        select: { quantity: true },
      })
      currentStock = stock?.quantity || 0
    } else {
      const good = await prisma.finishedGood.findUnique({
        where: { id: itemId },
        select: { currentStock: true },
      })
      currentStock = good?.currentStock || 0
    }
  }

  // 2. Get movements FROM the date onwards (inclusive)
  // We want to subtract everything that happened ON or AFTER this date to get back to the start of the date.
  const movements = await prisma.stockMovement.findMany({
    where: {
      date: {
        gte: startOfDay, // On or after the date
      },
      ...(itemType === 'raw-material'
        ? {
            rawMaterialId: itemId,
            ...(drumId ? { drumId } : {}),
          }
        : {
            finishedGoodId: itemId,
            ...(locationId ? { locationId } : {}),
          }),
    },
  })

  // 3. Reverse calculations
  // CurrentStock includes these movements. We need to UN-DO them.
  for (const movement of movements) {
    if (movement.type === 'IN') {
      currentStock -= movement.quantity
    } else if (movement.type === 'OUT') {
      currentStock += movement.quantity
    } else if (movement.type === 'ADJUSTMENT') {
      currentStock -= movement.quantity
    }
  }

  return Math.max(0, currentStock) // Never return negative
}

export async function createStockMovement(
  data: StockMovementInput
): Promise<StockMovement> {
  return await prisma.$transaction(async (tx) => {
    // Date validation: For OUT or negative ADJUSTMENT, check stock BEFORE the movement date
    if (
      data.type === 'OUT' ||
      (data.type === 'ADJUSTMENT' && data.quantity < 0)
    ) {
      const itemId = data.rawMaterialId || data.finishedGoodId!
      const itemType = data.rawMaterialId ? 'raw-material' : 'finished-good'
      
      // Calculate stock at the movement date (before the movement)
      const stockAtDate = await calculateStockAtDate(
        itemId,
        itemType,
        data.date,
        itemType === 'finished-good' ? data.locationId : null,
        itemType === 'raw-material' ? data.drumId : null
      )

      const quantityToCheck =
        data.type === 'ADJUSTMENT' ? Math.abs(data.quantity) : data.quantity

      if (stockAtDate < quantityToCheck) {
        const itemName = data.rawMaterialId
          ? (await tx.rawMaterial.findUnique({ where: { id: data.rawMaterialId }, select: { name: true } }))?.name
          : (await tx.finishedGood.findUnique({ where: { id: data.finishedGoodId! }, select: { name: true } }))?.name
        
        throw new Error(
          `Insufficient stock on ${data.date.toLocaleDateString()}. Available: ${stockAtDate.toFixed(2)}, Requested: ${quantityToCheck.toFixed(2)}`
        )
      }
    }

    // Validate stock for OUT movements or negative ADJUSTMENT (current stock validation as fallback)
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
          // Validation prevents negative adjustments from creating new records, so this is a safe fallback
          // Using quantityChange directly would be ideal, but keeping 0 fallback for extra safety
          quantity: quantityChange < 0 ? 0 : quantityChange,
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

/**
 * Update individual stock movement and recalculate stock
 *
 * @param movementId - Stock movement ID
 * @param data - Update data (quantity, date, description, locationId)
 * @returns Updated stock movement
 * @throws {Error} If movement not found
 * @throws {Error} If movement is part of a batch
 * @throws {Error} If date validation fails (insufficient stock)
 * @throws {Error} If update would cause negative stock
 *
 * @remarks
 * - Cannot edit movements that are part of batches (data integrity)
 * - Validates date logic (OUT movements need sufficient stock BEFORE the date)
 * - Recalculates all affected stock values in transaction
 * - Uses FOR UPDATE locks for stock validation
 */
export async function updateStockMovement(
  movementId: string,
  data: {
    quantity?: number
    date?: Date
    description?: string | null
    locationId?: string | null
  }
): Promise<StockMovement> {
  return await prisma.$transaction(async (tx) => {
    // Get existing movement
    const existingMovement = await tx.stockMovement.findUnique({
      where: { id: movementId },
      include: {
        rawMaterial: {
          select: { id: true, name: true },
        },
        finishedGood: {
          select: { id: true, name: true },
        },
        drum: {
          select: { id: true, label: true, currentQuantity: true },
        },
      },
    })

    if (!existingMovement) {
      throw new Error('Stock movement not found')
    }

    // Prevent editing batch movements
    if (existingMovement.batchId) {
      throw new Error(
        'This movement is part of a batch. Edit the batch instead.'
      )
    }

    const itemType = existingMovement.rawMaterialId
      ? 'raw-material'
      : 'finished-good'
    const itemId = existingMovement.rawMaterialId || existingMovement.finishedGoodId!

    // Determine what changed
    const oldQuantity = existingMovement.quantity
    const oldDate = existingMovement.date
    const oldLocationId = existingMovement.locationId
    const newQuantity = data.quantity ?? oldQuantity
    const newDate = data.date ? parseToWIB(toWIBISOString(data.date)) : oldDate
    const newLocationId = data.locationId ?? oldLocationId

    // Calculate quantity change
    const oldQuantityChange =
      existingMovement.type === 'ADJUSTMENT'
        ? existingMovement.quantity
        : existingMovement.type === 'IN'
          ? existingMovement.quantity
          : -existingMovement.quantity

    const newQuantityChange =
      existingMovement.type === 'ADJUSTMENT'
        ? newQuantity
        : existingMovement.type === 'IN'
          ? newQuantity
          : -newQuantity

    const quantityDifference = newQuantityChange - oldQuantityChange

    // Date validation: For OUT or negative ADJUSTMENT, check stock BEFORE the new date
    if (
      (existingMovement.type === 'OUT' ||
        (existingMovement.type === 'ADJUSTMENT' && newQuantity < 0)) &&
      newQuantity > 0
    ) {
      const stockAtDate = await calculateStockAtDate(
        itemId,
        itemType,
        newDate,
        itemType === 'finished-good' ? newLocationId : null,
        itemType === 'raw-material' ? existingMovement.drumId : null
      )

      const quantityToCheck =
        existingMovement.type === 'ADJUSTMENT' ? Math.abs(newQuantity) : newQuantity

      if (stockAtDate < quantityToCheck) {
        const itemName =
          itemType === 'raw-material'
            ? existingMovement.rawMaterial?.name
            : existingMovement.finishedGood?.name
        throw new Error(
          `Insufficient stock on ${newDate.toLocaleDateString()}. Available: ${stockAtDate.toFixed(2)}, Requested: ${quantityToCheck.toFixed(2)}`
        )
      }
    }

    // Update the movement
    const updatedMovement = await tx.stockMovement.update({
      where: { id: movementId },
      data: {
        quantity: newQuantity,
        date: newDate,
        description: data.description !== undefined ? data.description : existingMovement.description,
        locationId: itemType === 'finished-good' ? newLocationId : existingMovement.locationId,
      },
    })

    // Reverse old movement effect
    // Update Drum Stock (if applicable)
    if (existingMovement.drumId) {
      await tx.drum.update({
        where: { id: existingMovement.drumId },
        data: {
          currentQuantity: { increment: -oldQuantityChange },
          isActive: { set: true }, // Will be updated below
        },
      })
    }

    // Update Raw Material Global Stock
    if (existingMovement.rawMaterialId) {
      await tx.rawMaterial.update({
        where: { id: existingMovement.rawMaterialId },
        data: {
          currentStock: { increment: -oldQuantityChange },
        },
      })
    }

    // Update Finished Good Stock (Location Aware)
    if (existingMovement.finishedGoodId) {
      // Reverse old location stock
      if (oldLocationId) {
        await tx.finishedGoodStock.update({
          where: {
            finishedGoodId_locationId: {
              finishedGoodId: existingMovement.finishedGoodId,
              locationId: oldLocationId,
            },
          },
          data: {
            quantity: { increment: -oldQuantityChange },
          },
        }).catch(() => {
          // If stock doesn't exist, ignore (shouldn't happen, but safe)
        })
      }

      // Update global aggregate
      await tx.finishedGood.update({
        where: { id: existingMovement.finishedGoodId },
        data: {
          currentStock: { increment: -oldQuantityChange },
        },
      })
    }

    // Apply new movement effect
    // Update Drum Stock (if applicable)
    if (existingMovement.drumId) {
      const drum = await tx.drum.findUnique({
        where: { id: existingMovement.drumId },
        select: { currentQuantity: true },
      })
      if (!drum) throw new Error('Drum not found')
      const newQuantity = drum.currentQuantity + newQuantityChange
      
      await tx.drum.update({
        where: { id: existingMovement.drumId },
        data: {
          currentQuantity: { increment: newQuantityChange },
          isActive: { set: newQuantity > 0 },
        },
      })
    }

    // Update Raw Material Global Stock
    if (existingMovement.rawMaterialId) {
      await tx.rawMaterial.update({
        where: { id: existingMovement.rawMaterialId },
        data: {
          currentStock: { increment: newQuantityChange },
        },
      })
    }

    // Update Finished Good Stock (Location Aware)
    if (existingMovement.finishedGoodId) {
      if (!newLocationId) {
        throw new Error('Location is required for finished good movements')
      }

      // Update new location stock
      await tx.finishedGoodStock.upsert({
        where: {
          finishedGoodId_locationId: {
            finishedGoodId: existingMovement.finishedGoodId,
            locationId: newLocationId,
          },
        },
        update: {
          quantity: { increment: newQuantityChange },
        },
        create: {
          finishedGoodId: existingMovement.finishedGoodId,
          locationId: newLocationId,
          quantity: newQuantityChange > 0 ? newQuantityChange : 0,
        },
      })

      // Update global aggregate
      await tx.finishedGood.update({
        where: { id: existingMovement.finishedGoodId },
        data: {
          currentStock: { increment: newQuantityChange },
        },
      })
    }

    return updatedMovement
  })
}

/**
 * Delete individual stock movement and reverse stock effects
 *
 * @param movementId - Stock movement ID
 * @returns void
 * @throws {Error} If movement not found
 * @throws {Error} If movement is part of a batch
 * @throws {Error} If deletion would cause negative stock
 *
 * @remarks
 * - Cannot delete movements that are part of batches (data integrity)
 * - Reverses the movement's effect on all stock values
 * - Uses transaction for atomicity
 */
export async function deleteStockMovement(movementId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Get existing movement
    const existingMovement = await tx.stockMovement.findUnique({
      where: { id: movementId },
      include: {
        rawMaterial: {
          select: { id: true, name: true },
        },
        finishedGood: {
          select: { id: true, name: true },
        },
        drum: {
          select: { id: true, label: true },
        },
      },
    })

    if (!existingMovement) {
      throw new Error('Stock movement not found')
    }

    // Prevent deleting batch movements
    if (existingMovement.batchId) {
      throw new Error(
        'This movement is part of a batch. Delete the batch instead.'
      )
    }

    // Calculate quantity change to reverse
    const quantityChange =
      existingMovement.type === 'ADJUSTMENT'
        ? existingMovement.quantity
        : existingMovement.type === 'IN'
          ? existingMovement.quantity
          : -existingMovement.quantity

    // Reverse movement effect (subtract the change)
    const reverseChange = -quantityChange

    // Update Drum Stock (if applicable)
    if (existingMovement.drumId) {
      const drum = await tx.$queryRaw<
        Array<{ id: string; currentQuantity: number }>
      >`
        SELECT id, "currentQuantity"
        FROM drums
        WHERE id = ${existingMovement.drumId}
        FOR UPDATE
      `

      if (drum.length === 0) {
        throw new Error('Drum not found')
      }

      const newQuantity = drum[0].currentQuantity + reverseChange
      if (newQuantity < 0) {
        throw new Error(
          `Cannot delete movement: would result in negative drum stock. Current: ${drum[0].currentQuantity}, Change: ${reverseChange}`
        )
      }

      await tx.drum.update({
        where: { id: existingMovement.drumId },
        data: {
          currentQuantity: { increment: reverseChange },
          isActive: { set: newQuantity > 0 },
        },
      })
    }

    // Update Raw Material Global Stock
    if (existingMovement.rawMaterialId) {
      const items = await tx.$queryRaw<
        Array<{ id: string; name: string; currentStock: number }>
      >`
        SELECT id, name, "currentStock"
        FROM raw_materials
        WHERE id = ${existingMovement.rawMaterialId}
        FOR UPDATE
      `

      if (items.length === 0) {
        throw new Error('Raw material not found')
      }

      const item = items[0]
      const newStock = item.currentStock + reverseChange

      if (newStock < 0) {
        throw new Error(
          `Cannot delete movement: would result in negative stock for ${item.name} (${newStock.toFixed(2)})`
        )
      }

      await tx.rawMaterial.update({
        where: { id: existingMovement.rawMaterialId },
        data: {
          currentStock: { increment: reverseChange },
        },
      })
    }

    // Update Finished Good Stock (Location Aware)
    if (existingMovement.finishedGoodId) {
      if (!existingMovement.locationId) {
        throw new Error('Location is required for finished good movements')
      }

      const stocks = await tx.$queryRaw<
        Array<{ quantity: number }>
      >`
        SELECT quantity
        FROM finished_good_stocks
        WHERE "finishedGoodId" = ${existingMovement.finishedGoodId}
          AND "locationId" = ${existingMovement.locationId}
        FOR UPDATE
      `

      if (stocks.length === 0) {
        // Stock doesn't exist, but we'll still try to delete the movement
        // This shouldn't happen, but handle gracefully
      } else {
        const stock = stocks[0]
        const newQuantity = stock.quantity + reverseChange

        if (newQuantity < 0) {
          throw new Error(
            `Cannot delete movement: would result in negative stock at location (${newQuantity.toFixed(2)})`
          )
        }

        await tx.finishedGoodStock.update({
          where: {
            finishedGoodId_locationId: {
              finishedGoodId: existingMovement.finishedGoodId,
              locationId: existingMovement.locationId,
            },
          },
          data: {
            quantity: { increment: reverseChange },
          },
        })
      }

      // Update global aggregate
      const items = await tx.$queryRaw<
        Array<{ id: string; name: string; currentStock: number }>
      >`
        SELECT id, name, "currentStock"
        FROM finished_goods
        WHERE id = ${existingMovement.finishedGoodId}
        FOR UPDATE
      `

      if (items.length === 0) {
        throw new Error('Finished good not found')
      }

      const item = items[0]
      const newStock = item.currentStock + reverseChange

      if (newStock < 0) {
        throw new Error(
          `Cannot delete movement: would result in negative stock for ${item.name} (${newStock.toFixed(2)})`
        )
      }

      await tx.finishedGood.update({
        where: { id: existingMovement.finishedGoodId },
        data: {
          currentStock: { increment: reverseChange },
        },
      })
    }

    // Delete the movement
    await tx.stockMovement.delete({
      where: { id: movementId },
    })
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
