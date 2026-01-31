/**
 * Batch Service
 *
 * Handles all database operations for production batches
 * Separates business logic from API route handlers
 *
 * This is the most complex service with multi-table transactions
 */

import { prisma } from '@/lib/db'
import { Batch, Prisma } from '@prisma/client'
import { PaginationOptions, PaginationMetadata } from './raw-material.service'
import {
  calculateStockAtDate,
  validateRawMaterialStockConsistency,
} from './stock-movement.service'
import { wibCalendarDateToUTCStartOfDay } from '@/lib/timezone'

// Debug logging helper - uses fetch (works in server-side Next.js)
function debugLog(location: string, message: string, data: unknown) {
  const logEntry = {
    location,
    message,
    data,
    timestamp: Date.now(),
    sessionId: 'debug-session',
    runId: 'phase2',
    hypothesisId: 'C',
  }
  fetch('http://127.0.0.1:7242/ingest/d8baa842-95ab-4bfd-967a-af7151fa0e4e', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(logEntry),
  }).catch(() => {})
}

/**
 * Batch input type for service layer
 * Supports multiple drums per material entry
 */
export interface BatchInput {
  code: string
  date: Date
  description?: string | null
  materials: Array<{
    rawMaterialId: string
    drums: Array<{
      drumId: string
      quantity: number
    }>
  }>
}

/**
 * Batch with full details including relations
 */
export type BatchWithDetails = Batch & {
  batchUsages: Array<{
    id: string
    quantity: number
    rawMaterial: {
      id: string
      kode: string
      name: string
    }
    drum: {
      id: string
      label: string
    } | null
  }>
}

/**
 * Batch select object for consistent relation loading
 */
const batchSelect = {
  id: true,
  code: true,
  date: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  batchUsages: {
    select: {
      id: true,
      quantity: true,
      rawMaterial: {
        select: {
          id: true,
          kode: true,
          name: true,
        },
      },
      drum: {
        select: {
          id: true,
          label: true,
        },
      },
    },
  },
} satisfies Prisma.BatchSelect

/**
 * Get all batches with optional pagination
 *
 * @param options - Optional pagination parameters
 * @returns Batches list with relations, with pagination metadata if pagination is used
 *
 * @remarks
 * - If no pagination options provided, returns all batches
 * - Includes batchUsages with nested relations
 * - Results ordered by creation date (newest first)
 */
export async function getBatches(
  options?: PaginationOptions
): Promise<
  | BatchWithDetails[]
  | { data: BatchWithDetails[]; pagination: PaginationMetadata }
> {
  if (!options?.page && !options?.limit) {
    const batches = await prisma.batch.findMany({
      select: batchSelect,
      orderBy: { createdAt: 'desc' },
    })
    return batches as BatchWithDetails[]
  }

  const page = Math.max(1, options.page || 1)
  const limit = Math.min(100, Math.max(1, options.limit || 50))
  const skip = (page - 1) * limit

  const [batches, total] = await Promise.all([
    prisma.batch.findMany({
      skip,
      take: limit,
      select: batchSelect,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.batch.count(),
  ])

  return {
    data: batches as BatchWithDetails[],
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + batches.length < total,
    },
  }
}

/**
 * Get a single batch by ID with full details
 *
 * @param id - Batch ID
 * @returns Batch with all relations
 * @throws {Error} If batch not found
 */
export async function getBatchById(id: string): Promise<BatchWithDetails> {
  const batch = await prisma.batch.findUnique({
    where: { id },
    include: {
      batchUsages: {
        include: {
          rawMaterial: true,
          drum: {
            select: {
              id: true,
              label: true,
            },
          },
        },
      },
    },
  })

  if (!batch) {
    throw new Error('Batch not found')
  }

  return {
    ...batch,
    batchUsages: batch.batchUsages.map((usage) => ({
      id: usage.id,
      quantity: usage.quantity,
      rawMaterial: {
        id: usage.rawMaterial.id,
        kode: usage.rawMaterial.kode,
        name: usage.rawMaterial.name,
      },
      drum: usage.drum
        ? {
            id: usage.drum.id,
            label: usage.drum.label,
          }
        : null,
    })),
  } as BatchWithDetails
}

/**
 * Create a new production batch with automatic stock deduction
 *
 * @param data - Batch input data (validated)
 * @returns Created batch
 * @throws {Error} If duplicate batch code
 * @throws {Error} If duplicate materials in batch
 * @throws {Error} If raw material not found
 * @throws {Error} If insufficient stock for any raw material
 *
 * @remarks
 * - Uses transaction to ensure atomicity
 * - Uses FOR UPDATE locks to prevent race conditions
 * - Automatically creates:
 *   - Batch record
 *   - BatchUsage records (one per raw material)
 *   - StockMovement records (OUT for materials)
 * - Automatically updates stock (decrements materials)
 * - Validates sufficient stock before creating batch
 */
export async function createBatch(data: BatchInput): Promise<Batch> {
  // Pre-transaction: Check for duplicate batch code
  const existingBatch = await prisma.batch.findFirst({
    where: { code: data.code },
  })

  if (existingBatch) {
    throw new Error(`Batch code "${data.code}" already exists`)
  }

  // Pre-transaction: Check for duplicate materials
  const materialIds = data.materials.map((m) => m.rawMaterialId)
  const uniqueMaterialIds = new Set(materialIds)
  if (materialIds.length !== uniqueMaterialIds.size) {
    throw new Error(
      'Duplicate materials found in batch. Each material can only be used once per batch.'
    )
  }

  // Pre-transaction: Check for duplicate drums across all materials
  const allDrumIds: string[] = []
  for (const material of data.materials) {
    for (const drum of material.drums) {
      if (drum.drumId) {
        allDrumIds.push(drum.drumId)
      }
    }
  }
  const uniqueDrumIds = new Set(allDrumIds)
  if (allDrumIds.length !== uniqueDrumIds.size) {
    throw new Error(
      'Duplicate drums found in batch. Each drum can only be used once per batch.'
    )
  }

  // Transaction: Create batch and all related records
  // Set timeout to 30 seconds to handle large batches
  return await prisma.$transaction(
    async (tx) => {
      // Normalize batch date to start-of-day WIB before storing
      // This ensures all dates represent calendar dates (00:00:00 WIB) rather than arbitrary timestamps
      // wibCalendarDateToUTCStartOfDay extracts the calendar date in WIB and creates UTC Date for WIB 00:00:00
      const normalizedBatchDate = wibCalendarDateToUTCStartOfDay(data.date)

      // Step 1: Validate all raw materials exist and calculate total quantities
      for (const material of data.materials) {
        const totalQuantity = material.drums.reduce(
          (sum, drum) => sum + drum.quantity,
          0
        )

        const rawMaterials = await tx.$queryRaw<
          Array<{ id: string; name: string; currentStock: number }>
        >`
        SELECT id, name, "currentStock"
        FROM raw_materials
        WHERE id = ${material.rawMaterialId}
        FOR UPDATE
      `

        if (rawMaterials.length === 0) {
          throw new Error(`Raw material not found: ${material.rawMaterialId}`)
        }

        const rawMaterial = rawMaterials[0]

        if (rawMaterial.currentStock < totalQuantity) {
          throw new Error(
            `Insufficient stock for ${rawMaterial.name}. Available: ${rawMaterial.currentStock}, Required: ${totalQuantity}`
          )
        }
      }

      // Step 1.5: Validate stock existed on batch date (date validation)
      // For each material/drum combination, ensure stock existed BEFORE the batch date
      for (const material of data.materials) {
        for (const drumEntry of material.drums) {
          // #region agent log
          debugLog('batch.service.ts:277', 'batch stock validation BEFORE calculateStockAtDate', {
            rawMaterialId: material.rawMaterialId,
            drumId: drumEntry.drumId,
            batchDate: data.date.toISOString(),
            requiredQuantity: drumEntry.quantity,
          })
          // #endregion

          // Calculate stock at batch date (includes all movements on that day)
          // For batch validation, we check stock available at the batch date
          // This includes all movements created on the same day (before batch creation)
          // movementCreatedAt is null, so calculateStockAtDate includes ALL same-day movements
          const stockAtDate = await calculateStockAtDate(
            material.rawMaterialId,
            'raw-material',
            data.date,
            null, // No location for raw materials
            drumEntry.drumId || null,
            null, // excludeMovementId (not needed for batch validation)
            null // movementCreatedAt (null = include all same-day movements)
          )

          // #region agent log
          debugLog('batch.service.ts:290', 'batch stock validation result', {
            stockAtDate,
            requiredQuantity: drumEntry.quantity,
            isValid: stockAtDate >= drumEntry.quantity,
            drumId: drumEntry.drumId,
          })
          // #endregion

          if (stockAtDate < drumEntry.quantity) {
            const rawMaterial = await tx.rawMaterial.findUnique({
              where: { id: material.rawMaterialId },
              select: { name: true },
            })
            const materialName = rawMaterial?.name || 'Unknown'
            const drumLabel = drumEntry.drumId
              ? (
                  await tx.drum.findUnique({
                    where: { id: drumEntry.drumId },
                    select: { label: true },
                  })
                )?.label
              : null
            const itemLabel = drumLabel
              ? `${materialName} (Drum ${drumLabel})`
              : materialName

            // #region agent log
            debugLog('batch.service.ts:308', 'batch stock validation FAILED', {
              stockAtDate,
              requiredQuantity: drumEntry.quantity,
              itemLabel,
              batchDate: data.date.toISOString(),
            })
            // #endregion

            throw new Error(
              `Insufficient stock on ${data.date.toLocaleDateString()}. Available: ${stockAtDate.toFixed(2)}, Required: ${drumEntry.quantity.toFixed(2)} for ${itemLabel}`
            )
          }
        }
      }

      // Step 2: Create the batch with normalized date
      const batch = await tx.batch.create({
        data: {
          code: data.code,
          date: normalizedBatchDate,
          description: data.description,
        },
      })

      // Step 3: Process each raw material and its drums
      for (const material of data.materials) {
        const totalQuantity = material.drums.reduce(
          (sum, drum) => sum + drum.quantity,
          0
        )

        // Validate Raw Material Stock (Aggregate)
        const rawMaterials = await tx.$queryRaw<
          Array<{ id: string; name: string; currentStock: number }>
        >`
        SELECT id, name, "currentStock"
        FROM raw_materials
        WHERE id = ${material.rawMaterialId}
        FOR UPDATE
      `

        if (rawMaterials.length === 0) {
          throw new Error(`Raw material not found: ${material.rawMaterialId}`)
        }

        const rawMaterial = rawMaterials[0]

        if (rawMaterial.currentStock < totalQuantity) {
          throw new Error(
            `Insufficient stock for ${rawMaterial.name}. Available: ${rawMaterial.currentStock}, Required: ${totalQuantity}`
          )
        }

        // #region agent log
        const rawMaterialBefore = await tx.rawMaterial.findUnique({
          where: { id: material.rawMaterialId },
          select: { currentStock: true },
        })
        const aggregateBeforeStock = rawMaterialBefore?.currentStock ?? null
        
        // Get all drums for this material before update
        const drumsBefore = await tx.drum.findMany({
          where: { rawMaterialId: material.rawMaterialId },
          select: { id: true, label: true, currentQuantity: true },
        })
        const drumsBeforeMap = new Map(drumsBefore.map(d => [d.id, d.currentQuantity]))
        // #endregion

        // Process each drum for this material
        for (const drumEntry of material.drums) {
          // Validate drum exists and has sufficient stock
          let drum = null
          if (drumEntry.drumId) {
            drum = await tx.drum.findUnique({
              where: { id: drumEntry.drumId },
            })
            if (!drum) {
              throw new Error(`Drum not found: ${drumEntry.drumId}`)
            }
            if (drum.rawMaterialId !== material.rawMaterialId) {
              throw new Error(
                `Drum ${drum.label} does not belong to material ${rawMaterial.name}`
              )
            }
            if (drum.currentQuantity < drumEntry.quantity) {
              throw new Error(
                `Insufficient stock in drum ${drum.label}. Available: ${drum.currentQuantity}, Required: ${drumEntry.quantity}`
              )
            }
          }

          // Create batch usage
          await tx.batchUsage.create({
            data: {
              batchId: batch.id,
              rawMaterialId: material.rawMaterialId,
              quantity: drumEntry.quantity,
              drumId: drumEntry.drumId,
            },
          })

          // Create stock OUT movement with normalized date
          await tx.stockMovement.create({
            data: {
              type: 'OUT',
              quantity: drumEntry.quantity,
              date: normalizedBatchDate,
              description: `Batch production: ${data.code}`,
              rawMaterialId: material.rawMaterialId,
              batchId: batch.id,
              drumId: drumEntry.drumId,
            },
          })

          // Update Drum Stock if drumId exists (reuse the drum object from validation)
          if (drumEntry.drumId && drum) {
            await tx.drum.update({
              where: { id: drumEntry.drumId },
              data: {
                currentQuantity: { decrement: drumEntry.quantity },
                isActive: {
                  set: drum.currentQuantity - drumEntry.quantity > 0,
                },
              },
            })
          }
        }

        // Update Raw Material Aggregate Stock (once per material, total of all drums)
        await tx.rawMaterial.update({
          where: { id: material.rawMaterialId },
          data: {
            currentStock: {
              decrement: totalQuantity,
            },
          },
        })

        // #region agent log
        const rawMaterialAfter = await tx.rawMaterial.findUnique({
          where: { id: material.rawMaterialId },
          select: { currentStock: true },
        })
        const aggregateAfterStock = rawMaterialAfter?.currentStock ?? null
        
        // Get all drums for this material after update
        const drumsAfter = await tx.drum.findMany({
          where: { rawMaterialId: material.rawMaterialId },
          select: { id: true, label: true, currentQuantity: true },
        })
        const drumsAfterMap = new Map(drumsAfter.map(d => [d.id, d.currentQuantity]))
        
        const sumOfDrumsBefore = drumsBefore.reduce((sum, d) => sum + d.currentQuantity, 0)
        const sumOfDrumsAfter = drumsAfter.reduce((sum, d) => sum + d.currentQuantity, 0)
        
        const drumChanges = material.drums.map(d => ({
          drumId: d.drumId,
          quantity: d.quantity,
          drumBefore: d.drumId ? drumsBeforeMap.get(d.drumId) : null,
          drumAfter: d.drumId ? drumsAfterMap.get(d.drumId) : null,
        }))
        
        debugLog('batch.service.ts:465', 'createBatch stock updates', {
          rawMaterialId: material.rawMaterialId,
          batchId: batch.id,
          totalQuantity,
          aggregateBeforeStock,
          aggregateAfterStock,
          sumOfDrumsBefore,
          sumOfDrumsAfter,
          drumChanges,
        })
        // #endregion

        // Validate consistency: aggregate stock should equal sum of drums
        await validateRawMaterialStockConsistency(material.rawMaterialId, tx)
      }

      return batch
    },
    {
      maxWait: 10000, // Maximum time to wait for a transaction slot (10 seconds)
      timeout: 30000, // Maximum time the transaction can run (30 seconds)
    }
  )
}

/**
 * Update an existing batch and recalculate stock
 *
 * @param id - Batch ID
 * @param data - Updated batch data (validated)
 * @returns Updated batch with relations
 * @throws {Error} If batch not found
 * @throws {Error} If duplicate code (excluding current batch)
 * @throws {Error} If duplicate materials
 * @throws {Error} If raw material not found
 * @throws {Error} If insufficient stock
 *
 * @remarks
 * - Most complex update operation
 * - Restores old stock, then applies new changes
 * - Uses FOR UPDATE locks for stock validation
 * - Deletes old relations and creates new ones
 */
export async function updateBatch(
  id: string,
  data: BatchInput
): Promise<BatchWithDetails> {
  // Pre-transaction: Get existing batch
  const existingBatch = await prisma.batch.findUnique({
    where: { id },
    include: {
      batchUsages: true,
    },
  })

  if (!existingBatch) {
    throw new Error('Batch not found')
  }

  // Pre-transaction: Check for duplicate code (excluding current batch)
  const duplicateCode = await prisma.batch.findFirst({
    where: {
      code: data.code,
      id: { not: id },
    },
  })

  if (duplicateCode) {
    throw new Error(`Batch code "${data.code}" already exists`)
  }

  // Pre-transaction: Check for duplicate materials
  const materialIds = data.materials.map((m) => m.rawMaterialId)
  const uniqueMaterialIds = new Set(materialIds)
  if (materialIds.length !== uniqueMaterialIds.size) {
    throw new Error(
      'Duplicate materials found in batch. Each material can only be used once per batch.'
    )
  }

  // Pre-transaction: Check for duplicate drums across all materials
  const allDrumIds: string[] = []
  for (const material of data.materials) {
    for (const drum of material.drums) {
      if (drum.drumId) {
        allDrumIds.push(drum.drumId)
      }
    }
  }
  const uniqueDrumIds = new Set(allDrumIds)
  if (allDrumIds.length !== uniqueDrumIds.size) {
    throw new Error(
      'Duplicate drums found in batch. Each drum can only be used once per batch.'
    )
  }

  // Transaction: Handle batch updates
  // Set timeout to 30 seconds to handle large batches
  return await prisma.$transaction(
    async (tx) => {
      // Normalize batch date to start-of-day WIB before storing
      // This ensures all dates represent calendar dates (00:00:00 WIB) rather than arbitrary timestamps
      // wibCalendarDateToUTCStartOfDay extracts the calendar date in WIB and creates UTC Date for WIB 00:00:00
      const normalizedBatchDate = wibCalendarDateToUTCStartOfDay(data.date)

      // Step 1: Restore stock for all old materials and drums
      // Track which materials we've restored to validate once per material
      const restoredMaterials = new Set<string>()
      for (const oldUsage of existingBatch.batchUsages) {
        // Restore raw material stock
        await tx.rawMaterial.update({
          where: { id: oldUsage.rawMaterialId },
          data: {
            currentStock: {
              increment: oldUsage.quantity,
            },
          },
        })

        // Restore drum stock if it exists
        if (oldUsage.drumId) {
          await tx.drum.update({
            where: { id: oldUsage.drumId },
            data: {
              currentQuantity: {
                increment: oldUsage.quantity,
              },
              isActive: true, // Reactivate if it was deactivated
            },
          })
        }

        // Delete old stock movement
        await tx.stockMovement.deleteMany({
          where: {
            batchId: id,
            rawMaterialId: oldUsage.rawMaterialId,
          },
        })

        // Validate consistency after restoring this material (once per material)
        if (!restoredMaterials.has(oldUsage.rawMaterialId)) {
          await validateRawMaterialStockConsistency(oldUsage.rawMaterialId, tx)
          restoredMaterials.add(oldUsage.rawMaterialId)
        }
      }

      // Step 2: Delete all old batch usages
      await tx.batchUsage.deleteMany({
        where: { batchId: id },
      })

      // Step 3: Create new batch usages and deduct stock
      for (const material of data.materials) {
        const totalQuantity = material.drums.reduce(
          (sum, drum) => sum + drum.quantity,
          0
        )

        // Check if raw material has enough stock with row locking
        const rawMaterials = await tx.$queryRaw<
          Array<{ id: string; name: string; currentStock: number }>
        >`
        SELECT id, name, "currentStock"
        FROM raw_materials
        WHERE id = ${material.rawMaterialId}
        FOR UPDATE
      `

        if (rawMaterials.length === 0) {
          throw new Error(`Raw material not found: ${material.rawMaterialId}`)
        }

        const rawMaterial = rawMaterials[0]

        if (rawMaterial.currentStock < totalQuantity) {
          throw new Error(
            `Insufficient stock for ${rawMaterial.name}. Available: ${rawMaterial.currentStock}, Required: ${totalQuantity}`
          )
        }

        // Process each drum for this material
        for (const drumEntry of material.drums) {
          // Validate drum exists and has sufficient stock
          let drum = null
          if (drumEntry.drumId) {
            drum = await tx.drum.findUnique({
              where: { id: drumEntry.drumId },
            })
            if (!drum) {
              throw new Error(`Drum not found: ${drumEntry.drumId}`)
            }
            if (drum.rawMaterialId !== material.rawMaterialId) {
              throw new Error(
                `Drum ${drum.label} does not belong to material ${rawMaterial.name}`
              )
            }
            if (drum.currentQuantity < drumEntry.quantity) {
              throw new Error(
                `Insufficient stock in drum ${drum.label}. Available: ${drum.currentQuantity}, Required: ${drumEntry.quantity}`
              )
            }
          }

          // Create batch usage
          await tx.batchUsage.create({
            data: {
              batchId: id,
              rawMaterialId: material.rawMaterialId,
              quantity: drumEntry.quantity,
              drumId: drumEntry.drumId,
            },
          })

          // Create stock movement (OUT) with normalized date
          await tx.stockMovement.create({
            data: {
              type: 'OUT',
              quantity: drumEntry.quantity,
              date: normalizedBatchDate,
              rawMaterialId: material.rawMaterialId,
              batchId: id,
              description: `Batch ${data.code} production`,
              drumId: drumEntry.drumId,
            },
          })

          // Update Drum Stock if drumId exists (reuse the drum object from validation)
          if (drumEntry.drumId && drum) {
            await tx.drum.update({
              where: { id: drumEntry.drumId },
              data: {
                currentQuantity: { decrement: drumEntry.quantity },
                isActive: {
                  set: drum.currentQuantity - drumEntry.quantity > 0,
                },
              },
            })
          }
        }

        // Deduct stock (Aggregate) - total of all drums for this material
        await tx.rawMaterial.update({
          where: { id: material.rawMaterialId },
          data: {
            currentStock: {
              decrement: totalQuantity,
            },
          },
        })

        // Validate consistency: aggregate stock should equal sum of drums
        await validateRawMaterialStockConsistency(material.rawMaterialId, tx)
      }

      // Step 4: Update batch info with normalized date
      const updatedBatch = await tx.batch.update({
        where: { id },
        data: {
          code: data.code,
          date: normalizedBatchDate,
          description: data.description,
        },
        include: {
          batchUsages: {
            include: {
              rawMaterial: true,
              drum: {
                select: {
                  id: true,
                  label: true,
                },
              },
            },
          },
        },
      })

      return {
        ...updatedBatch,
        batchUsages: updatedBatch.batchUsages.map((usage) => ({
          id: usage.id,
          quantity: usage.quantity,
          rawMaterial: {
            id: usage.rawMaterial.id,
            kode: usage.rawMaterial.kode,
            name: usage.rawMaterial.name,
          },
          drum: usage.drum
            ? {
                id: usage.drum.id,
                label: usage.drum.label,
              }
            : null,
        })),
      } as BatchWithDetails
    },
    {
      maxWait: 10000, // Maximum time to wait for a transaction slot (10 seconds)
      timeout: 30000, // Maximum time the transaction can run (30 seconds)
    }
  )
}

/**
 * Delete a batch and restore all stock
 *
 * @param id - Batch ID
 * @returns void
 * @throws {Error} If batch not found
 *
 * @remarks
 * - Restores all stock before deletion
 * - Deletes all related records in correct order
 * - Uses transaction to ensure atomicity
 */
export async function deleteBatch(id: string): Promise<void> {
  // Pre-transaction: Get batch with relations
  const existingBatch = await prisma.batch.findUnique({
    where: { id },
    include: {
      batchUsages: true,
    },
  })

  if (!existingBatch) {
    throw new Error('Batch not found')
  }

  // Transaction: Delete batch and restore stock
  await prisma.$transaction(async (tx) => {
    // Step 1: Restore raw material stock (and Drum stock)
    // Track which materials we've restored to validate once per material
    const restoredMaterials = new Set<string>()
    for (const batchUsage of existingBatch.batchUsages) {
      await tx.rawMaterial.update({
        where: { id: batchUsage.rawMaterialId },
        data: {
          currentStock: {
            increment: batchUsage.quantity,
          },
        },
      })

      // Restore Drum Stock if exists
      if (batchUsage.drumId) {
        await tx.drum.update({
          where: { id: batchUsage.drumId },
          data: {
            currentQuantity: {
              increment: batchUsage.quantity,
            },
            isActive: true, // Reactivate if it was deactivated (simple logic)
          },
        })
      }

      // Validate consistency after restoring this material (once per material)
      if (!restoredMaterials.has(batchUsage.rawMaterialId)) {
        await validateRawMaterialStockConsistency(batchUsage.rawMaterialId, tx)
        restoredMaterials.add(batchUsage.rawMaterialId)
      }
    }

    // Step 2: Delete stock movements associated with this batch FIRST
    // This prevents orphaned movements with NULL batchId
    await tx.stockMovement.deleteMany({
      where: { batchId: id },
    })

    // Step 3: Delete all batch usages
    await tx.batchUsage.deleteMany({
      where: { batchId: id },
    })

    // Step 4: Delete the batch
    await tx.batch.delete({
      where: { id },
    })
  })
}
