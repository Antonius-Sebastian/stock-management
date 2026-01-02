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
 * Matches API route structure with finishedGoods array
 */
export interface BatchInput {
  code: string
  date: Date
  description?: string | null
  status?: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  finishedGoods?: Array<{
    finishedGoodId: string
    quantity: number
  }>
  materials: Array<{
    rawMaterialId: string
    quantity: number
  }>
}

/**
 * Batch with full details including relations
 */
export type BatchWithDetails = Batch & {
  batchFinishedGoods: Array<{
    id: string
    quantity: number
    finishedGood: {
      id: string
      name: string
    }
  }>
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
  status: true,
  createdAt: true,
  updatedAt: true,
  batchFinishedGoods: {
    select: {
      id: true,
      quantity: true,
      finishedGood: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
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
 * - Includes batchFinishedGoods and batchUsages with nested relations
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
      batchFinishedGoods: {
        include: {
          finishedGood: true,
        },
      },
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
 * @throws {Error} If duplicate finished goods in batch
 * @throws {Error} If raw material not found
 * @throws {Error} If finished good not found
 * @throws {Error} If insufficient stock for any raw material
 *
 * @remarks
 * - Uses transaction to ensure atomicity
 * - Uses FOR UPDATE locks to prevent race conditions
 * - Automatically creates:
 *   - Batch record
 *   - BatchUsage records (one per raw material)
 *   - BatchFinishedGood records (one per finished good)
 *   - StockMovement records (OUT for materials, IN for finished goods)
 * - Automatically updates stock (decrements materials, increments finished goods)
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

  // Pre-transaction: Check for duplicate finished goods (if provided)
  if (data.finishedGoods && data.finishedGoods.length > 0) {
    const finishedGoodIds = data.finishedGoods.map((fg) => fg.finishedGoodId)
    const uniqueFinishedGoodIds = new Set(finishedGoodIds)
    if (finishedGoodIds.length !== uniqueFinishedGoodIds.size) {
      throw new Error(
        'Duplicate finished goods found in batch. Each finished good can only be used once per batch.'
      )
    }
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

    // Step 2: Validate all finished goods exist (if provided)
    if (data.finishedGoods && data.finishedGoods.length > 0) {
      for (const fg of data.finishedGoods) {
        const finishedGood = await tx.finishedGood.findUnique({
          where: { id: fg.finishedGoodId },
        })

        if (!finishedGood) {
          throw new Error(`Finished good not found: ${fg.finishedGoodId}`)
        }
      }
    }

    // Step 3: Create the batch
    // If finished goods are provided, status should be COMPLETED, otherwise IN_PROGRESS
    const batchStatus =
      data.status ||
      (data.finishedGoods && data.finishedGoods.length > 0
        ? 'COMPLETED'
        : 'IN_PROGRESS')

    const batch = await tx.batch.create({
      data: {
        code: data.code,
        date: data.date,
        description: data.description,
        status: batchStatus,
      },
    })

    // Step 4: Process each raw material
    for (const material of data.materials) {
      // Create batch usage
      await tx.batchUsage.create({
        data: {
          batchId: batch.id,
          rawMaterialId: material.rawMaterialId,
          quantity: material.quantity,
        },
      })

      // Create stock OUT movement for raw material
      await tx.stockMovement.create({
        data: {
          type: 'OUT',
          quantity: material.quantity,
          date: data.date,
          description: `Batch production: ${data.code}`,
          rawMaterialId: material.rawMaterialId,
          batchId: batch.id,
        },
      })

      // Update raw material current stock
      await tx.rawMaterial.update({
        where: { id: material.rawMaterialId },
        data: {
          currentStock: {
            decrement: material.quantity,
          },
        },
      })
    }

    // Step 5: Process each finished good (if provided)
    if (data.finishedGoods && data.finishedGoods.length > 0) {
      for (const finishedGood of data.finishedGoods) {
        // Create batch finished good record
        await tx.batchFinishedGood.create({
          data: {
            batchId: batch.id,
            finishedGoodId: finishedGood.finishedGoodId,
            quantity: finishedGood.quantity,
          },
        })

        // Create stock IN movement for finished good
        await tx.stockMovement.create({
          data: {
            type: 'IN',
            quantity: finishedGood.quantity,
            date: data.date,
            description: `Batch production: ${data.code}`,
            finishedGoodId: finishedGood.finishedGoodId,
            batchId: batch.id,
          },
        })

        // Update finished good current stock
        await tx.finishedGood.update({
          where: { id: finishedGood.finishedGoodId },
          data: {
            currentStock: {
              increment: finishedGood.quantity,
            },
          },
        })
      }
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
 * @throws {Error} If duplicate materials/finished goods
 * @throws {Error} If raw material not found
 * @throws {Error} If finished good not found
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
      batchFinishedGoods: true,
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

  // Pre-transaction: Check for duplicate finished goods (if provided)
  if (data.finishedGoods && data.finishedGoods.length > 0) {
    const finishedGoodIds = data.finishedGoods.map((fg) => fg.finishedGoodId)
    const uniqueFinishedGoodIds = new Set(finishedGoodIds)
    if (finishedGoodIds.length !== uniqueFinishedGoodIds.size) {
      throw new Error(
        'Duplicate finished goods found in batch. Each finished good can only be used once per batch.'
      )
    }
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
    // Step 1: Restore stock for all old finished goods
    for (const oldFinishedGood of existingBatch.batchFinishedGoods) {
      await tx.finishedGood.update({
        where: { id: oldFinishedGood.finishedGoodId },
        data: {
          currentStock: {
            decrement: oldFinishedGood.quantity,
          },
        },
      })

      // Delete old finished good IN stock movements
      await tx.stockMovement.deleteMany({
        where: {
          batchId: id,
          finishedGoodId: oldFinishedGood.finishedGoodId,
          type: 'IN',
        },
      })
    }

    // Step 2: Delete all old batch finished goods
    await tx.batchFinishedGood.deleteMany({
      where: { batchId: id },
    })

    // Step 3: Restore stock for all old materials
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

    // Step 4: Delete all old batch usages
    await tx.batchUsage.deleteMany({
      where: { batchId: id },
    })

    // Step 5: Create new finished goods and add stock (if provided)
    if (data.finishedGoods && data.finishedGoods.length > 0) {
      for (const finishedGood of data.finishedGoods) {
        // Verify finished good exists with row locking for consistency
        const finishedGoods = await tx.$queryRaw<
          Array<{ id: string; name: string; currentStock: number }>
        >`
        SELECT id, name, "currentStock"
        FROM finished_goods
        WHERE id = ${finishedGood.finishedGoodId}
        FOR UPDATE
      `

        if (finishedGoods.length === 0) {
          throw new Error(
            `Finished good not found: ${finishedGood.finishedGoodId}`
          )
        }

        // Create batch finished good record
        await tx.batchFinishedGood.create({
          data: {
            batchId: id,
            finishedGoodId: finishedGood.finishedGoodId,
            quantity: finishedGood.quantity,
          },
        })

        // Create stock IN movement for finished good
        await tx.stockMovement.create({
          data: {
            type: 'IN',
            quantity: finishedGood.quantity,
            date: data.date,
            description: `Batch ${data.code} production`,
            finishedGoodId: finishedGood.finishedGoodId,
            batchId: id,
          },
        })

        // Update finished good current stock
        await tx.finishedGood.update({
          where: { id: finishedGood.finishedGoodId },
          data: {
            currentStock: {
              increment: finishedGood.quantity,
            },
          },
        })
      }
    }

    // Step 6: Create new batch usages and deduct stock
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

      // Create batch usage
      await tx.batchUsage.create({
        data: {
          batchId: id,
          rawMaterialId: material.rawMaterialId,
          quantity: material.quantity,
        },
      })

      // Deduct stock
      await tx.rawMaterial.update({
        where: { id: material.rawMaterialId },
        data: {
          currentStock: {
            decrement: material.quantity,
          },
        },
      })

      // Create stock movement (OUT)
      await tx.stockMovement.create({
        data: {
          type: 'OUT',
          quantity: material.quantity,
          date: data.date,
          rawMaterialId: material.rawMaterialId,
          batchId: id,
          description: `Batch ${data.code} production`,
        },
      })
    }

    // Step 7: Update batch info
    const updatedBatch = await tx.batch.update({
      where: { id },
      data: {
        code: data.code,
        date: data.date,
        description: data.description,
        ...(data.status && { status: data.status }),
      },
      include: {
        batchFinishedGoods: {
          include: {
            finishedGood: true,
          },
        },
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
      batchFinishedGoods: true,
    },
  })

  if (!existingBatch) {
    throw new Error('Batch not found')
  }

  // Transaction: Delete batch and restore stock
  await prisma.$transaction(async (tx) => {
    // Step 1: Restore finished good stock
    for (const batchFinishedGood of existingBatch.batchFinishedGoods) {
      await tx.finishedGood.update({
        where: { id: batchFinishedGood.finishedGoodId },
        data: {
          currentStock: {
            decrement: batchFinishedGood.quantity,
          },
        },
      })
    }

    // Step 2: Restore raw material stock
    for (const batchUsage of existingBatch.batchUsages) {
      await tx.rawMaterial.update({
        where: { id: batchUsage.rawMaterialId },
        data: {
          currentStock: {
            increment: batchUsage.quantity,
          },
        },
      })
    }

    // Step 3: Delete stock movements associated with this batch FIRST
    // This prevents orphaned movements with NULL batchId
    await tx.stockMovement.deleteMany({
      where: { batchId: id },
    })

    // Step 4: Delete all batch finished goods
    await tx.batchFinishedGood.deleteMany({
      where: { batchId: id },
    })

    // Step 5: Delete all batch usages
    await tx.batchUsage.deleteMany({
      where: { batchId: id },
    })

    // Step 6: Delete the batch
    await tx.batch.delete({
      where: { id },
    })
  })
}
