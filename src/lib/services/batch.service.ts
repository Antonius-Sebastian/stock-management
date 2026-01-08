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

/**
 * Batch input type for service layer
 */
export interface BatchInput {
  code: string
  date: Date
  description?: string | null
  materials: Array<{
    rawMaterialId: string
    quantity: number
    drumId?: string
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
        },
      },
    },
  })

  if (!batch) {
    throw new Error('Batch not found')
  }

  return batch as BatchWithDetails
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

  // Transaction: Create batch and all related records
  return await prisma.$transaction(async (tx) => {
    // Step 1: Validate all raw materials exist and have sufficient stock
    for (const material of data.materials) {
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

      if (rawMaterial.currentStock < material.quantity) {
        throw new Error(
          `Insufficient stock for ${rawMaterial.name}. Available: ${rawMaterial.currentStock}, Required: ${material.quantity}`
        )
      }
    }

    // Step 2: Create the batch
    const batch = await tx.batch.create({
      data: {
        code: data.code,
        date: data.date,
        description: data.description,
      },
    })

    // Step 3: Process each raw material
    for (const material of data.materials) {
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

      if (rawMaterial.currentStock < material.quantity) {
        throw new Error(
          `Insufficient stock for ${rawMaterial.name}. Available: ${rawMaterial.currentStock}, Required: ${material.quantity}`
        )
      }

      // Determine Distribution (FIFO vs Explicit)
      const distribution: Array<{ drumId?: string; quantity: number }> = []

      if (material.drumId) {
        // Explicit Drum Selection
        distribution.push({
          drumId: material.drumId,
          quantity: material.quantity,
        })
      } else {
        // Auto (FIFO) or Legacy
        // Fetch active drums for this material
        const drums = await tx.drum.findMany({
          where: {
            rawMaterialId: material.rawMaterialId,
            isActive: true,
            currentQuantity: { gt: 0 },
          },
          orderBy: { createdAt: 'asc' }, // FIFO
        })

        if (drums.length === 0) {
          // No drums available, use general stock (Legacy)
          distribution.push({ quantity: material.quantity })
        } else {
          // Distribute across drums (FIFO)
          let remainingNeeded = material.quantity

          for (const drum of drums) {
            if (remainingNeeded <= 0) break

            const takeAmount = Math.min(remainingNeeded, drum.currentQuantity)
            distribution.push({
              drumId: drum.id,
              quantity: takeAmount,
            })

            remainingNeeded -= takeAmount
          }

          // If still need more stock (and ran out of drums), take from general
          if (remainingNeeded > 0) {
            distribution.push({ quantity: remainingNeeded })
          }
        }
      }

      // Execute Distribution
      for (const dist of distribution) {
        // Create batch usage
        await tx.batchUsage.create({
          data: {
            batchId: batch.id,
            rawMaterialId: material.rawMaterialId,
            quantity: dist.quantity,
            drumId: dist.drumId,
          },
        })

        // Create stock OUT movement
        await tx.stockMovement.create({
          data: {
            type: 'OUT',
            quantity: dist.quantity,
            date: data.date,
            description: `Batch production: ${data.code}`,
            rawMaterialId: material.rawMaterialId,
            batchId: batch.id,
            drumId: dist.drumId,
          },
        })

        // Update Drum Stock if drumId exists
        if (dist.drumId) {
          const drum = await tx.drum.findUnique({
            where: { id: dist.drumId },
          })
          if (!drum) throw new Error(`Drum not found: ${dist.drumId}`)

          if (drum.currentQuantity < dist.quantity) {
            // Should not happen with FIFO logic above, but safety check for explicit selection
            throw new Error(`Insufficient stock in drum ${drum.label}`)
          }

          await tx.drum.update({
            where: { id: dist.drumId },
            data: {
              currentQuantity: { decrement: dist.quantity },
              isActive: {
                set: drum.currentQuantity - dist.quantity > 0,
              },
            },
          })
        }
      }

      // Update Raw Material Aggregate Stock (once per material line)
      await tx.rawMaterial.update({
        where: { id: material.rawMaterialId },
        data: {
          currentStock: {
            decrement: material.quantity,
          },
        },
      })
    }

    return batch
  })
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

  // Transaction: Handle batch updates
  return await prisma.$transaction(async (tx) => {
    // Step 1: Restore stock for all old materials
    for (const oldUsage of existingBatch.batchUsages) {
      await tx.rawMaterial.update({
        where: { id: oldUsage.rawMaterialId },
        data: {
          currentStock: {
            increment: oldUsage.quantity,
          },
        },
      })

      // Delete old stock movement
      await tx.stockMovement.deleteMany({
        where: {
          batchId: id,
          rawMaterialId: oldUsage.rawMaterialId,
        },
      })
    }

    // Step 2: Delete all old batch usages
    await tx.batchUsage.deleteMany({
      where: { batchId: id },
    })

    // Step 3: Create new batch usages and deduct stock
    for (const material of data.materials) {
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

      if (rawMaterial.currentStock < material.quantity) {
        throw new Error(
          `Insufficient stock for ${rawMaterial.name}. Available: ${rawMaterial.currentStock}, Required: ${material.quantity}`
        )
      }

      // Determine Distribution (FIFO vs Explicit)
      const distribution: Array<{ drumId?: string; quantity: number }> = []

      if (material.drumId) {
        // Explicit Drum Selection
        distribution.push({
          drumId: material.drumId,
          quantity: material.quantity,
        })
      } else {
        // Auto (FIFO) or Legacy
        // Fetch active drums for this material
        const drums = await tx.drum.findMany({
          where: {
            rawMaterialId: material.rawMaterialId,
            isActive: true,
            currentQuantity: { gt: 0 },
          },
          orderBy: { createdAt: 'asc' }, // FIFO
        })

        if (drums.length === 0) {
          // No drums available, use general stock (Legacy)
          distribution.push({ quantity: material.quantity })
        } else {
          // Distribute across drums (FIFO)
          let remainingNeeded = material.quantity

          for (const drum of drums) {
            if (remainingNeeded <= 0) break

            const takeAmount = Math.min(remainingNeeded, drum.currentQuantity)
            distribution.push({
              drumId: drum.id,
              quantity: takeAmount,
            })

            remainingNeeded -= takeAmount
          }

          // If still need more stock (and ran out of drums), take from general
          if (remainingNeeded > 0) {
            distribution.push({ quantity: remainingNeeded })
          }
        }
      }

      // Execute Distribution
      for (const dist of distribution) {
        // Create batch usage
        await tx.batchUsage.create({
          data: {
            batchId: id,
            rawMaterialId: material.rawMaterialId,
            quantity: dist.quantity,
            drumId: dist.drumId,
          },
        })

        // Create stock movement (OUT)
        await tx.stockMovement.create({
          data: {
            type: 'OUT',
            quantity: dist.quantity,
            date: data.date,
            rawMaterialId: material.rawMaterialId,
            batchId: id,
            description: `Batch ${data.code} production`,
            drumId: dist.drumId,
          },
        })

        // Update Dictionary Drum Stock if drumId provided
        if (dist.drumId) {
          const drum = await tx.drum.findUnique({ where: { id: dist.drumId } })
          if (!drum) throw new Error(`Drum not found: ${dist.drumId}`)

          if (drum.currentQuantity < dist.quantity) {
            // Safety check
            throw new Error(`Insufficient stock in drum ${drum.label}`)
          }

          await tx.drum.update({
            where: { id: dist.drumId },
            data: {
              currentQuantity: { decrement: dist.quantity },
              isActive: { set: drum.currentQuantity - dist.quantity > 0 },
            },
          })
        }
      }

      // Deduct stock (Aggregate)
      await tx.rawMaterial.update({
        where: { id: material.rawMaterialId },
        data: {
          currentStock: {
            decrement: material.quantity,
          },
        },
      })
    }

    // Step 4: Update batch info
    const updatedBatch = await tx.batch.update({
      where: { id },
      data: {
        code: data.code,
        date: data.date,
        description: data.description,
      },
      include: {
        batchUsages: {
          include: {
            rawMaterial: true,
          },
        },
      },
    })

    return updatedBatch as BatchWithDetails
  })
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
