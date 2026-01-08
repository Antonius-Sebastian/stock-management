/**
 * Finished Good Service
 *
 * Handles all database operations for finished goods
 * Separates business logic from API route handlers
 */

import { prisma } from '@/lib/db'
import { FinishedGoodInput } from '@/lib/validations'
import { FinishedGood } from '@prisma/client'
import { PaginationOptions, PaginationMetadata } from './raw-material.service'

export interface GetFinishedGoodsOptions extends PaginationOptions {
  locationId?: string
}

/**
 * Get all finished goods with optional pagination and location filtering
 *
 * @param options - Optional pagination and location filter parameters
 * @returns Finished goods list, with pagination metadata if pagination is used
 *
 * @remarks
 * - If no pagination options provided, returns all finished goods
 * - Pagination: page (min 1), limit (1-100, default 50)
 * - Results ordered by creation date (newest first)
 * - If locationId provided, currentStock will reflect stock for that location only
 */
export async function getFinishedGoods(
  options?: GetFinishedGoodsOptions
): Promise<
  FinishedGood[] | { data: FinishedGood[]; pagination: PaginationMetadata }
> {
  const locationId = options?.locationId

  if (!options?.page && !options?.limit) {
    const finishedGoods = await prisma.finishedGood.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        stocks: {
          include: { location: true },
        },
      },
    })

    // Transform to show location-specific stock if locationId provided
    if (locationId) {
      return finishedGoods.map((fg) => {
        const locationStock = fg.stocks.find(
          (stock) => stock.locationId === locationId
        )
        return {
          ...fg,
          currentStock: locationStock?.quantity || 0,
        }
      })
    }

    return finishedGoods
  }

  const page = Math.max(1, options.page || 1)
  const limit = Math.min(100, Math.max(1, options.limit || 50))
  const skip = (page - 1) * limit

  const [finishedGoods, total] = await Promise.all([
    prisma.finishedGood.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        stocks: {
          include: { location: true },
        },
      },
    }),
    prisma.finishedGood.count(),
  ])

  // Transform to show location-specific stock if locationId provided
  const transformedGoods = locationId
    ? finishedGoods.map((fg) => {
        const locationStock = fg.stocks.find(
          (stock) => stock.locationId === locationId
        )
        return {
          ...fg,
          currentStock: locationStock?.quantity || 0,
        }
      })
    : finishedGoods

  return {
    data: transformedGoods,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + finishedGoods.length < total,
    },
  }
}

/**
 * Get a single finished good by ID
 *
 * @param id - Finished good ID
 * @returns Finished good
 * @throws {Error} If finished good not found
 */
export async function getFinishedGoodById(id: string): Promise<FinishedGood> {
  const finishedGood = await prisma.finishedGood.findUnique({
    where: { id },
  })

  if (!finishedGood) {
    throw new Error('Finished good not found')
  }

  return finishedGood
}

/**
 * Create a new finished good
 *
 * @param data - Finished good input data (validated)
 * @returns Created finished good
 * @throws {Error} If finished good name already exists
 *
 * @remarks
 * - Always starts with currentStock = 0
 * - Validates duplicate name before creation
 */
export async function createFinishedGood(
  data: FinishedGoodInput
): Promise<FinishedGood> {
  const existing = await prisma.finishedGood.findFirst({
    where: { name: data.name },
  })

  if (existing) {
    throw new Error(`Product "${data.name}" already exists`)
  }

  return await prisma.finishedGood.create({
    data: {
      ...data,
      currentStock: 0,
    },
  })
}

/**
 * Update an existing finished good
 *
 * @param id - Finished good ID
 * @param data - Updated finished good data (validated)
 * @returns Updated finished good
 * @throws {Error} If finished good not found
 * @throws {Error} If finished good name already exists (excluding current)
 *
 * @remarks
 * - Validates duplicate name excluding current finished good
 * - Does not update currentStock (only changed via movements)
 */
export async function updateFinishedGood(
  id: string,
  data: FinishedGoodInput
): Promise<FinishedGood> {
  const existing = await prisma.finishedGood.findUnique({
    where: { id },
  })

  if (!existing) {
    throw new Error('Finished good not found')
  }

  const duplicate = await prisma.finishedGood.findFirst({
    where: {
      name: data.name,
      id: { not: id },
    },
  })

  if (duplicate) {
    throw new Error(`Product "${data.name}" already exists`)
  }

  return await prisma.finishedGood.update({
    where: { id },
    data,
  })
}

/**
 * Delete a finished good
 *
 * @param id - Finished good ID
 * @returns void
 * @throws {Error} If finished good not found
 * @throws {Error} If finished good has transaction history
 *
 * @remarks
 * - Checks for stock movements before deletion
 * - Prevents deletion if used in transactions
 */
export async function deleteFinishedGood(id: string): Promise<void> {
  const existing = await prisma.finishedGood.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          stockMovements: true,
        },
      },
    },
  })

  if (!existing) {
    throw new Error('Finished good not found')
  }

  if (existing._count.stockMovements > 0) {
    throw new Error('Cannot delete finished good that has stock movements')
  }

  await prisma.finishedGood.delete({
    where: { id },
  })
}
