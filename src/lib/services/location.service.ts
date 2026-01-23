import { prisma } from '@/lib/db'

export interface LocationInput {
  name: string
  address?: string
  isDefault?: boolean
}

/**
 * Get all locations
 * @returns Array of locations ordered by default (first) and name
 */
export async function getLocations() {
  return await prisma.location.findMany({
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  })
}

/**
 * Get a specific location by ID
 * @param id Location ID
 * @returns Location object or null
 */
export async function getLocationById(id: string) {
  return await prisma.location.findUnique({
    where: { id },
  })
}

/**
 * Create a new location
 * @param data Location data
 * @returns Created location
 */
export async function createLocation(data: LocationInput) {
  // Check for duplicate name
  const existing = await prisma.location.findUnique({
    where: { name: data.name },
  })

  if (existing) {
    throw new Error(`Location with name "${data.name}" already exists`)
  }

  // If this is set as default, unset previous default
  if (data.isDefault) {
    await prisma.location.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    })
  }

  return await prisma.location.create({
    data: {
      name: data.name,
      address: data.address,
      isDefault: data.isDefault || false,
    },
  })
}

/**
 * Update a location
 * @param id Location ID
 * @param data Updated data
 * @returns Updated location
 */
export async function updateLocation(id: string, data: Partial<LocationInput>) {
  // Check for name uniqueness if name is changing
  if (data.name) {
    const existing = await prisma.location.findUnique({
      where: { name: data.name },
    })

    if (existing && existing.id !== id) {
      throw new Error(`Location with name "${data.name}" already exists`)
    }
  }

  // If setting as default, unset others (transaction)
  if (data.isDefault) {
    return await prisma.$transaction(async (tx) => {
      await tx.location.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })

      return await tx.location.update({
        where: { id },
        data,
      })
    })
  }

  return await prisma.location.update({
    where: { id },
    data,
  })
}

/**
 * Delete a location
 * @param id Location ID
 * @throws Error if location has associated stocks or movements
 */
export async function deleteLocation(id: string) {
  // Check usages
  const stockCount = await prisma.finishedGoodStock.count({
    where: { locationId: id, quantity: { gt: 0 } },
  })

  if (stockCount > 0) {
    throw new Error('Cannot delete location with active stock.')
  }

  const movementCount = await prisma.stockMovement.count({
    where: { locationId: id },
  })

  if (movementCount > 0) {
    // Soft delete or block?
    // Requirements say "Audit Trail", so maybe we shouldn't delete locations with history.
    // For now, strict block.
    throw new Error('Cannot delete location with associated movement history.')
  }

  return await prisma.location.delete({
    where: { id },
  })
}
