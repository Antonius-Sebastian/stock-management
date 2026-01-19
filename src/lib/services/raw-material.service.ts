/**
 * Raw Material Service
 *
 * Handles all database operations for raw materials
 * Separates business logic from API route handlers
 */

import { prisma } from '@/lib/db'
import { RawMaterialInput } from '@/lib/validations'
import { RawMaterial, Drum } from '@prisma/client'

/**
 * Pagination options for list queries
 */
export interface PaginationOptions {
  page?: number
  limit?: number
  includeDrums?: boolean
}

/**
 * Pagination metadata returned with paginated results
 */
export interface PaginationMetadata {
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore: boolean
}

/**
 * Get all raw materials with optional pagination
 *
 * @param options - Optional pagination parameters
 * @returns Raw materials list, with pagination metadata if pagination is used
 *
 * @remarks
 * - If no pagination options provided, returns all materials
 * - Pagination: page (min 1), limit (1-100, default 50)
 * - Results ordered by creation date (newest first)
 */
export async function getRawMaterials(options?: PaginationOptions): Promise<
  | (RawMaterial & { drums?: Drum[] })[]
  | {
      data: (RawMaterial & { drums?: Drum[] })[]
      pagination: PaginationMetadata
    }
> {
  const include = options?.includeDrums
    ? {
        drums: {
          where: { isActive: true, currentQuantity: { gt: 0 } },
          orderBy: { createdAt: 'asc' as const },
        },
      }
    : undefined

  if (!options?.page && !options?.limit) {
    return await prisma.rawMaterial.findMany({
      orderBy: { createdAt: 'desc' },
      include,
    })
  }

  const page = Math.max(1, options.page || 1)
  const limit = Math.min(100, Math.max(1, options.limit || 50))
  const skip = (page - 1) * limit

  const [rawMaterials, total] = await Promise.all([
    prisma.rawMaterial.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include,
    }),
    prisma.rawMaterial.count(),
  ])

  return {
    data: rawMaterials,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + rawMaterials.length < total,
    },
  }
}

/**
 * Get a single raw material by ID
 *
 * @param id - Raw material ID
 * @returns Raw material
 * @throws {Error} If raw material not found
 */
export async function getRawMaterialById(id: string): Promise<RawMaterial> {
  const material = await prisma.rawMaterial.findUnique({
    where: { id },
  })

  if (!material) {
    throw new Error('Raw material not found')
  }

  return material
}

/**
 * Create a new raw material
 *
 * @param data - Raw material input data (validated)
 * @returns Created raw material
 * @throws {Error} If material code already exists
 *
 * @remarks
 * - Always starts with currentStock = 0
 * - Validates duplicate code before creation
 */
export async function createRawMaterial(
  data: RawMaterialInput
): Promise<RawMaterial> {
  const existing = await prisma.rawMaterial.findFirst({
    where: { kode: data.kode },
  })

  if (existing) {
    throw new Error(`Material code "${data.kode}" already exists`)
  }

  return await prisma.rawMaterial.create({
    data: {
      ...data,
      currentStock: 0,
    },
  })
}

/**
 * Update an existing raw material
 *
 * @param id - Raw material ID
 * @param data - Updated raw material data (validated)
 * @returns Updated raw material
 * @throws {Error} If raw material not found
 * @throws {Error} If material code already exists (excluding current material)
 *
 * @remarks
 * - Validates duplicate code excluding current material
 * - Does not update currentStock (only changed via movements)
 */
export async function updateRawMaterial(
  id: string,
  data: RawMaterialInput
): Promise<RawMaterial> {
  const existing = await prisma.rawMaterial.findUnique({
    where: { id },
  })

  if (!existing) {
    throw new Error('Raw material not found')
  }

  const duplicate = await prisma.rawMaterial.findFirst({
    where: {
      kode: data.kode,
      id: { not: id },
    },
  })

  if (duplicate) {
    throw new Error(`Material code "${data.kode}" already exists`)
  }

  return await prisma.rawMaterial.update({
    where: { id },
    data,
  })
}

/**
 * Delete a raw material
 *
 * @param id - Raw material ID
 * @returns void
 * @throws {Error} If raw material not found
 *
 * @remarks
 * - Cascade deletes handled by Prisma schema
 * - Should check for transaction history (currently not enforced)
 */
export async function deleteRawMaterial(id: string): Promise<void> {
  const existing = await prisma.rawMaterial.findUnique({
    where: { id },
  })

  if (!existing) {
    throw new Error('Raw material not found')
  }

  await prisma.rawMaterial.delete({
    where: { id },
  })
}

/**
 * Get stock movement history for a raw material with running balance
 *
 * @param id - Raw material ID
 * @param limit - Optional limit of movements to fetch (default: 500)
 * @returns Material info and movements with running balance
 * @throws {Error} If raw material not found
 *
 * @remarks
 * - Optimized to work backwards from current stock
 * - Fetches newest movements first (DESC)
 * - Defaults to limiting to latest 500 movements to prevent performance issues with large history
 */
export async function getRawMaterialMovements(
  id: string,
  limit: number = 500
): Promise<{
  material: Pick<RawMaterial, 'id' | 'kode' | 'name' | 'currentStock' | 'moq'>
  movements: Array<{
    id: string
    type: string
    quantity: number
    date: Date
    description: string | null
    batch: { id: string; code: string } | null
    drum: { label: string } | null
    runningBalance: number
    createdAt: Date
  }>
}> {
  const material = await prisma.rawMaterial.findUnique({
    where: { id },
    select: {
      id: true,
      kode: true,
      name: true,
      currentStock: true,
      moq: true,
    },
  })

  if (!material) {
    throw new Error('Raw material not found')
  }

  // Fetch movements Newest -> Oldest
  const movements = await prisma.stockMovement.findMany({
    where: {
      rawMaterialId: id,
    },
    include: {
      batch: {
        select: {
          id: true,
          code: true,
        },
      },
      drum: {
        select: {
          label: true,
        },
      },
    },
    orderBy: [
      { date: 'desc' },
      { createdAt: 'desc' }, // Secondary sort for chronological order on same day
    ],
    take: limit,
  })

  // Calculate running balance working backwards from current stock
  let runningBalance = material.currentStock

  const movementsWithBalance = movements.map((movement) => {
    // The balance displayed for this movement is the stock level AFTER this movement occurred.
    // Which, for the most recent movement, starts at current stock.
    const balanceForThisRow = runningBalance

    // Calculate the balance BEFORE this movement, which will be the "After Balance" for the NEXT (older) row.
    let change = 0
    if (movement.type === 'IN') {
      change = -movement.quantity
    } else if (movement.type === 'OUT') {
      change = movement.quantity
    } else if (movement.type === 'ADJUSTMENT') {
      // Adjustment quantity is signed (+ or -)
      // If we added Q, reverse is -Q
      change = -movement.quantity
    }

    runningBalance = Math.round((runningBalance + change) * 100) / 100

    return {
      id: movement.id,
      type: movement.type,
      quantity: movement.quantity,
      date: movement.date,
      description: movement.description,
      batch: movement.batch,
      drum: movement.drum,
      runningBalance: Math.round(balanceForThisRow * 100) / 100, // Round to 2 decimal places
      createdAt: movement.createdAt,
    }
  })

  // movements are already DESC (Newest First)
  return {
    material,
    movements: movementsWithBalance,
  }
}

/**
 * Get active drums for a raw material
 *
 * @param rawMaterialId - Raw material ID
 * @returns List of active drums with current quantity
 */
export async function getDrumsByRawMaterialId(
  rawMaterialId: string
): Promise<Drum[]> {
  return await prisma.drum.findMany({
    where: {
      rawMaterialId,
      // Return all drums (both active and inactive) - client-side filtering will handle visibility
    },
    orderBy: {
      createdAt: 'asc', // FIFO by default likely preferred
    },
  })
}
