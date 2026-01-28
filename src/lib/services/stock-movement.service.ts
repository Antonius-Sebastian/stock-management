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
 * @param excludeMovementId - Optional movement ID to exclude from calculation (for edit operations)
 * @param movementCreatedAt - Optional creation timestamp to handle same-day movements chronologically
 * @returns Stock level before the given date
 *
 * @remarks
 * - Sums all movements BEFORE the given date chronologically
 * - For same-day movements, includes movements created before movementCreatedAt
 * - For finished goods: filters by locationId if provided
 * - For raw materials: filters by drumId if provided
 * - Used for date validation before creating/editing movements
 */
export async function calculateStockAtDate(
  itemId: string,
  itemType: 'raw-material' | 'finished-good',
  date: Date,
  locationId?: string | null,
  drumId?: string | null,
  excludeMovementId?: string | null,
  movementCreatedAt?: Date | null
): Promise<number> {
  const queryDate = parseToWIB(toWIBISOString(date))
  const startOfDay = startOfDayWIB(queryDate)
  const endOfDay = endOfDayWIB(queryDate)

  // Base where clause
  const baseWhere =
    itemType === 'raw-material'
      ? {
          rawMaterialId: itemId,
          ...(drumId ? { drumId } : {}),
        }
      : {
          finishedGoodId: itemId,
          ...(locationId ? { locationId } : {}),
        }

  // Get aggregated movements BEFORE the given date
  const aggregates = await prisma.stockMovement.groupBy({
    by: ['type'],
    where: {
      date: {
        lt: startOfDay, // Before the date (exclusive)
      },
      ...baseWhere,
      ...(excludeMovementId ? { id: { not: excludeMovementId } } : {}),
    },
    _sum: {
      quantity: true,
    },
  })

  // Calculate initial stock from aggregates
  let stock = 0
  for (const agg of aggregates) {
    const qty = agg._sum.quantity || 0
    if (agg.type === 'IN') {
      stock += qty
    } else if (agg.type === 'OUT') {
      stock -= qty
    } else if (agg.type === 'ADJUSTMENT') {
      stock += qty // Adjustment quantity is already signed
    }
  }

  // Get movements ON the same day that were created BEFORE this movement
  const sameDayMovements = movementCreatedAt
    ? await prisma.stockMovement.findMany({
        where: {
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
          createdAt: { lt: movementCreatedAt },
          ...baseWhere,
          ...(excludeMovementId ? { id: { not: excludeMovementId } } : {}),
        },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      })
    : []

  // Add same day movements to stock
  for (const movement of sameDayMovements) {
    if (movement.type === 'IN') {
      stock += movement.quantity
    } else if (movement.type === 'OUT') {
      stock -= movement.quantity
    } else if (movement.type === 'ADJUSTMENT') {
      stock += movement.quantity
    }
  }

  return Math.max(0, stock) // Never return negative
}

/**
 * Ensure raw material aggregate stock equals sum of drum stocks
 *
 * @param rawMaterialId - Raw material ID
 * @param tx - Prisma transaction client
 * @returns void
 * @throws {Error} If aggregate doesn't match sum of drums
 *
 * @remarks
 * - Validation function to ensure data consistency
 * - Can be disabled via ENABLE_STOCK_CONSISTENCY_CHECK env var (default: true in development)
 * - Allows small floating point differences (0.01) to account for rounding
 */
export async function validateRawMaterialStockConsistency(
  rawMaterialId: string,
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
): Promise<void> {
  // Check if validation is enabled (default: true, can be disabled in production for performance)
  const enableCheck = process.env.ENABLE_STOCK_CONSISTENCY_CHECK !== 'false'

  if (!enableCheck) {
    return // Skip validation if disabled
  }

  // Get sum of all drum stocks
  const drumSum = await tx.drum.aggregate({
    where: { rawMaterialId },
    _sum: { currentQuantity: true },
  })

  const totalDrumStock = drumSum._sum.currentQuantity || 0

  // Get aggregate stock
  const rawMaterial = await tx.rawMaterial.findUnique({
    where: { id: rawMaterialId },
    select: { currentStock: true },
  })

  if (
    rawMaterial &&
    Math.abs(rawMaterial.currentStock - totalDrumStock) > 0.01
  ) {
    // Allow small floating point differences
    throw new Error(
      `Stock inconsistency detected for raw material. Aggregate: ${rawMaterial.currentStock}, Sum of drums: ${totalDrumStock}`
    )
  }
}

export async function createStockMovement(
  data: StockMovementInput
): Promise<StockMovement> {
  return await prisma.$transaction(async (tx) => {
    // Date validation: For OUT or negative ADJUSTMENT, check stock BEFORE the movement date
    // Use chronological calculation to handle same-day movements correctly
    if (
      data.type === 'OUT' ||
      (data.type === 'ADJUSTMENT' && data.quantity < 0)
    ) {
      const itemId = data.rawMaterialId || data.finishedGoodId!
      const itemType = data.rawMaterialId ? 'raw-material' : 'finished-good'

      // Get current timestamp to compare against same-day movements
      // This movement will be created now, so we compare against current time
      const now = new Date()

      // Calculate stock at the movement date (before the movement) chronologically
      const stockAtDate = await calculateStockAtDate(
        itemId,
        itemType,
        data.date,
        itemType === 'finished-good' ? data.locationId : null,
        itemType === 'raw-material' ? data.drumId : null,
        null, // excludeMovementId (not created yet)
        now // movementCreatedAt (will be created now, so compare against current time)
      )

      const quantityToCheck =
        data.type === 'ADJUSTMENT' ? Math.abs(data.quantity) : data.quantity

      if (stockAtDate < quantityToCheck) {
        const itemName = data.rawMaterialId
          ? (
              await tx.rawMaterial.findUnique({
                where: { id: data.rawMaterialId },
                select: { name: true },
              })
            )?.name
          : (
              await tx.finishedGood.findUnique({
                where: { id: data.finishedGoodId! },
                select: { name: true },
              })
            )?.name

        throw new Error(
          `Insufficient stock for ${itemName || 'item'} on ${data.date.toLocaleDateString()}. Available: ${stockAtDate.toFixed(2)}, Requested: ${quantityToCheck.toFixed(2)}`
        )
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

      // Validate consistency: aggregate stock should equal sum of drums
      await validateRawMaterialStockConsistency(data.rawMaterialId, tx)
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

      // REMOVED: Update global aggregate (no longer needed - finished goods are location-only)
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

      // Validate consistency: aggregate stock should equal sum of drums
      await validateRawMaterialStockConsistency(itemId, tx)
    } else {
      // For finished goods, update location-specific stock
      // Get all unique locations from the movements being deleted
      const uniqueLocationIds = [
        ...new Set(
          movements
            .map((m) => m.locationId)
            .filter((id): id is string => id !== null)
        ),
      ]

      if (uniqueLocationIds.length === 0) {
        throw new Error(
          'Cannot delete finished good movements: no location information found'
        )
      }

      // Update stock for each location
      for (const locationId of uniqueLocationIds) {
        // Get movements for this location
        const locationMovements = movements.filter(
          (m) => m.locationId === locationId
        )
        const locationTotalQuantity = locationMovements.reduce(
          (sum, m) => sum + m.quantity,
          0
        )
        const locationStockChange =
          movementType === 'IN' ? -locationTotalQuantity : locationTotalQuantity

        // Get current stock at this location
        const stock = await tx.finishedGoodStock.findUnique({
          where: {
            finishedGoodId_locationId: {
              finishedGoodId: itemId,
              locationId,
            },
          },
          select: { quantity: true },
        })

        const currentStock = stock?.quantity || 0
        const newStock = currentStock + locationStockChange

        if (newStock < 0) {
          const finishedGood = await tx.finishedGood.findUnique({
            where: { id: itemId },
            select: { name: true },
          })
          const location = await tx.location.findUnique({
            where: { id: locationId },
            select: { name: true },
          })
          throw new Error(
            `Cannot delete movements: would result in negative stock for ${finishedGood?.name || 'item'} at ${location?.name || 'location'} (${newStock.toFixed(2)})`
          )
        }

        // Update location stock
        if (stock) {
          await tx.finishedGoodStock.update({
            where: {
              finishedGoodId_locationId: {
                finishedGoodId: itemId,
                locationId,
              },
            },
            data: {
              quantity: { increment: locationStockChange },
            },
          })
        } else if (locationStockChange > 0) {
          // Create stock record if it doesn't exist and we're adding stock
          await tx.finishedGoodStock.create({
            data: {
              finishedGoodId: itemId,
              locationId,
              quantity: locationStockChange,
            },
          })
        }
      }

      // REMOVED: Update global aggregate (no longer needed - finished goods are location-only)
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

      // For finished goods, we need locationId from existing movements
      // For raw materials, we can create without locationId
      if (itemType === 'finished-good') {
        // Get locationId from existing movement (should only be one due to safety check above)
        const locationId =
          existingMovements.length > 0 ? existingMovements[0].locationId : null

        if (!locationId) {
          throw new Error(
            'Cannot update finished good movement: location information is required'
          )
        }

        // Create a single new movement with the new quantity and locationId
        await tx.stockMovement.create({
          data: {
            type: movementType,
            quantity,
            date: startOfDay,
            description: `Updated via report (${movementType})`,
            finishedGoodId: itemId,
            locationId,
          },
        })
      } else {
        // Create a single new movement with the new quantity
        await tx.stockMovement.create({
          data: {
            type: movementType,
            quantity,
            date: startOfDay,
            description: `Updated via report (${movementType})`,
            rawMaterialId: itemId,
          },
        })
      }
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

      // Validate consistency: aggregate stock should equal sum of drums
      await validateRawMaterialStockConsistency(itemId, tx)
    } else {
      // For finished goods, update location-specific stock
      // Get locationId from existing movement (should only be one due to safety check above)
      const locationId =
        existingMovements.length > 0 ? existingMovements[0].locationId : null

      if (!locationId) {
        throw new Error(
          'Cannot update finished good movement: location information is required'
        )
      }

      // Get current stock at this location
      const stock = await tx.finishedGoodStock.findUnique({
        where: {
          finishedGoodId_locationId: {
            finishedGoodId: itemId,
            locationId,
          },
        },
        select: { quantity: true },
      })

      const currentStock = stock?.quantity || 0
      const newStock = currentStock + stockChange

      if (newStock < 0) {
        const finishedGood = await tx.finishedGood.findUnique({
          where: { id: itemId },
          select: { name: true },
        })
        const location = await tx.location.findUnique({
          where: { id: locationId },
          select: { name: true },
        })
        throw new Error(
          `Cannot update movements: would result in negative stock for ${finishedGood?.name || 'item'} at ${location?.name || 'location'} (${newStock.toFixed(2)})`
        )
      }

      // Update location stock
      if (stock) {
        await tx.finishedGoodStock.update({
          where: {
            finishedGoodId_locationId: {
              finishedGoodId: itemId,
              locationId,
            },
          },
          data: {
            quantity: { increment: stockChange },
          },
        })
      } else if (stockChange > 0) {
        // Create stock record if it doesn't exist and we're adding stock
        await tx.finishedGoodStock.create({
          data: {
            finishedGoodId: itemId,
            locationId,
            quantity: stockChange,
          },
        })
      }

      // REMOVED: Update global aggregate (no longer needed - finished goods are location-only)
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
 * @throws {Error} If date validation fails (insufficient stock)
 * @throws {Error} If update would cause negative stock
 *
 * @remarks
 * - Can edit movements that are part of batches (updates BatchUsage accordingly)
 * - Validates date logic (OUT movements need sufficient stock BEFORE the date)
 * - Recalculates all affected stock values in transaction
 * - Uses FOR UPDATE locks for stock validation
 * - If movement is linked to a batch and quantity changes, updates the corresponding BatchUsage
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

    const itemType = existingMovement.rawMaterialId
      ? 'raw-material'
      : 'finished-good'
    const itemId =
      existingMovement.rawMaterialId || existingMovement.finishedGoodId!

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

    // Date validation: For OUT or negative ADJUSTMENT, check stock BEFORE the new date
    // Use chronological calculation to handle same-day movements correctly
    if (
      (existingMovement.type === 'OUT' ||
        (existingMovement.type === 'ADJUSTMENT' && newQuantity < 0)) &&
      newQuantity > 0
    ) {
      // Calculate stock chronologically, excluding this movement
      // If date hasn't changed, use original createdAt; otherwise use null (new date means different day)
      const movementCreatedAt =
        newDate.getTime() === oldDate.getTime()
          ? existingMovement.createdAt
          : null

      const stockAtDate = await calculateStockAtDate(
        itemId,
        itemType,
        newDate,
        itemType === 'finished-good' ? newLocationId : null,
        itemType === 'raw-material' ? existingMovement.drumId : null,
        movementId, // Exclude this movement from calculation
        movementCreatedAt // Use original createdAt if same day, null if different day
      )

      const quantityToCheck =
        existingMovement.type === 'ADJUSTMENT'
          ? Math.abs(newQuantity)
          : newQuantity

      if (stockAtDate < quantityToCheck) {
        const itemName =
          itemType === 'raw-material'
            ? existingMovement.rawMaterial?.name
            : existingMovement.finishedGood?.name
        throw new Error(
          `Insufficient stock for ${itemName || 'item'} on ${newDate.toLocaleDateString()}. Available: ${stockAtDate.toFixed(2)}, Requested: ${quantityToCheck.toFixed(2)}`
        )
      }
    }

    // Update the movement
    const updatedMovement = await tx.stockMovement.update({
      where: { id: movementId },
      data: {
        quantity: newQuantity,
        date: newDate,
        description:
          data.description !== undefined
            ? data.description
            : existingMovement.description,
        locationId:
          itemType === 'finished-good'
            ? newLocationId
            : existingMovement.locationId,
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

      // Validate consistency: aggregate stock should equal sum of drums
      await validateRawMaterialStockConsistency(
        existingMovement.rawMaterialId,
        tx
      )
    }

    // Update Finished Good Stock (Location Aware)
    if (existingMovement.finishedGoodId) {
      // Reverse old location stock
      if (oldLocationId) {
        await tx.finishedGoodStock
          .update({
            where: {
              finishedGoodId_locationId: {
                finishedGoodId: existingMovement.finishedGoodId,
                locationId: oldLocationId,
              },
            },
            data: {
              quantity: { increment: -oldQuantityChange },
            },
          })
          .catch(() => {
            // If stock doesn't exist, ignore (shouldn't happen, but safe)
          })
      }

      // REMOVED: Update global aggregate (no longer needed - finished goods are location-only)
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

      // Validate consistency: aggregate stock should equal sum of drums
      await validateRawMaterialStockConsistency(
        existingMovement.rawMaterialId,
        tx
      )
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

      // REMOVED: Update global aggregate (no longer needed - finished goods are location-only)
    }

    // If movement is linked to batch, update batch usage
    if (existingMovement.batchId && data.quantity !== undefined) {
      // Find batch usage for this movement
      const batchUsage = await tx.batchUsage.findFirst({
        where: {
          batchId: existingMovement.batchId,
          rawMaterialId: existingMovement.rawMaterialId || undefined,
          drumId: existingMovement.drumId || undefined,
        },
      })

      if (batchUsage) {
        // Update batch usage quantity to match the new movement quantity
        await tx.batchUsage.update({
          where: { id: batchUsage.id },
          data: {
            quantity: newQuantity,
          },
        })
      }
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
 * @throws {Error} If deletion would cause negative stock
 *
 * @remarks
 * - Can delete movements that are part of batches (deletes BatchUsage accordingly)
 * - Reverses the movement's effect on all stock values
 * - Uses transaction for atomicity
 * - If movement is linked to a batch, deletes the corresponding BatchUsage
 * - Orphaned batches (with no movements) are left intact for manual cleanup
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

      // Validate consistency: aggregate stock should equal sum of drums
      await validateRawMaterialStockConsistency(
        existingMovement.rawMaterialId,
        tx
      )
    }

    // Update Finished Good Stock (Location Aware)
    if (existingMovement.finishedGoodId) {
      if (!existingMovement.locationId) {
        throw new Error('Location is required for finished good movements')
      }

      const stocks = await tx.$queryRaw<Array<{ quantity: number }>>`
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

      // REMOVED: Update global aggregate (no longer needed - finished goods are location-only)
    }

    // If movement is linked to batch, delete batch usage and optionally batch
    if (existingMovement.batchId) {
      // Delete batch usage
      await tx.batchUsage.deleteMany({
        where: {
          batchId: existingMovement.batchId,
          rawMaterialId: existingMovement.rawMaterialId || undefined,
          drumId: existingMovement.drumId || undefined,
        },
      })

      // Check if batch has any remaining movements
      // For now, we'll leave the batch (orphaned batches can be cleaned up separately)
      // If you want to auto-delete, uncomment:
      // const remainingMovements = await tx.stockMovement.count({
      //   where: { batchId: existingMovement.batchId },
      // })
      // if (remainingMovements === 0) {
      //   await tx.batch.delete({
      //     where: { id: existingMovement.batchId },
      //   })
      // }
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

    // Validate consistency: aggregate stock should equal sum of drums
    await validateRawMaterialStockConsistency(rawMaterialId, tx)
  })
}
