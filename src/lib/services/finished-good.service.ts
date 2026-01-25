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

/**
 * Get finished good movements with running balance
 *
 * @param id - Finished good ID
 * @param options - Optional location filter and pagination parameters
 * @returns Finished good info and movements with running balance, with pagination metadata if pagination is used
 * @throws {Error} If finished good not found
 *
 * @remarks
 * - Fetches newest movements first (DESC)
 * - Default: page=1, limit=50, max limit=500
 * - If no pagination options provided, uses default limit of 500
 * - If locationId provided, filters movements and calculates location-specific running balance
 * - Running balance calculated working backwards from current stock
 */
export async function getFinishedGoodMovements(
  id: string,
  options?: {
    locationId?: string | null
    page?: number
    limit?: number
  }
): Promise<{
  finishedGood: Pick<FinishedGood, 'id' | 'name' | 'currentStock'>
  movements: Array<{
    id: string
    type: string
    quantity: number
    date: Date
    description: string | null
    batch: { id: string; code: string } | null
    location: { id: string; name: string } | null
    runningBalance: number
    createdAt: Date
  }>
  pagination?: PaginationMetadata
}> {
  const finishedGood = await prisma.finishedGood.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      currentStock: true,
    },
  })

  if (!finishedGood) {
    throw new Error('Finished good not found')
  }

  const locationId = options?.locationId

  // Get current stock at location (if locationId provided)
  let currentStock = finishedGood.currentStock
  if (locationId) {
    const stock = await prisma.finishedGoodStock.findUnique({
      where: {
        finishedGoodId_locationId: {
          finishedGoodId: id,
          locationId,
        },
      },
      select: { quantity: true },
    })
    currentStock = stock?.quantity || 0
  }

  // Pagination logic
  const page = options?.page ? Math.max(1, options.page) : 1
  const limit = options?.limit
    ? Math.min(500, Math.max(1, options.limit))
    : options?.page
      ? 50 // Default limit when pagination is used
      : 500 // Default limit when no pagination
  const skip = (page - 1) * limit

  // Get total count
  const total = await prisma.stockMovement.count({
    where: {
      finishedGoodId: id,
      ...(locationId ? { locationId } : {}),
    },
  })

  // Fetch movements (filtered by location if provided)
  const movements = await prisma.stockMovement.findMany({
    where: {
      finishedGoodId: id,
      ...(locationId ? { locationId } : {}),
    },
    include: {
      batch: {
        select: {
          id: true,
          code: true,
        },
      },
      location: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [
      { date: 'desc' },
      { createdAt: 'desc' }, // Secondary sort for chronological order on same day
    ],
    skip,
    take: limit,
  })

  // Calculate running balance working backwards from current stock
  // If paginating, we need to account for movements on previous pages
  let runningBalance = currentStock

  // If we're on a page beyond the first, calculate stock level at start of this page
  // by summing all movements that come before (on previous pages)
  if (skip > 0) {
    const previousMovements = await prisma.stockMovement.findMany({
      where: {
        finishedGoodId: id,
        ...(locationId ? { locationId } : {}),
      },
      select: {
        type: true,
        quantity: true,
      },
      orderBy: [
        { date: 'desc' },
        { createdAt: 'desc' },
      ],
      take: skip, // Get all movements before current page
    })

    // Sum up the effect of previous movements
    for (const prevMovement of previousMovements) {
      if (prevMovement.type === 'IN') {
        runningBalance -= prevMovement.quantity
      } else if (prevMovement.type === 'OUT') {
        runningBalance += prevMovement.quantity
      } else if (prevMovement.type === 'ADJUSTMENT') {
        runningBalance -= prevMovement.quantity // Adjustment is signed
      }
    }
    runningBalance = Math.round(runningBalance * 100) / 100
  }

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
      location: movement.location,
      runningBalance: Math.round(balanceForThisRow * 100) / 100, // Round to 2 decimal places
      createdAt: movement.createdAt,
    }
  })

  // Movements are already DESC (Newest First)
  const result: {
    finishedGood: Pick<FinishedGood, 'id' | 'name' | 'currentStock'>
    movements: Array<{
      id: string
      type: string
      quantity: number
      date: Date
      description: string | null
      batch: { id: string; code: string } | null
      location: { id: string; name: string } | null
      runningBalance: number
      createdAt: Date
    }>
    pagination?: PaginationMetadata
  } = {
    finishedGood: {
      ...finishedGood,
      currentStock, // Use the location-specific stock if locationId was provided
    },
    movements: movementsWithBalance,
  }

  // Add pagination metadata if pagination is used
  if (options?.page || options?.limit) {
    result.pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + movements.length < total,
    }
  }

  return result
}
