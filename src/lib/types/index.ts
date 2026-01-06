/**
 * Shared Type Definitions
 *
 * Central location for common types used across the application.
 * Import types from here: import type { RawMaterial, FinishedGood } from '@/lib/types'
 */

/**
 * Raw Material type for component usage
 * Note: For Prisma types, use @prisma/client directly
 */
export interface RawMaterial {
  id: string
  name: string
  kode: string
  currentStock: number
  moq?: number
}

/**
 * Finished Good type for component usage
 * Note: For Prisma types, use @prisma/client directly
 */
export interface FinishedGood {
  id: string
  name: string
  sku?: string
  currentStock?: number
}

/**
 * Generic Item type for selectors (can be RawMaterial or FinishedGood)
 */
export interface Item {
  id: string
  name: string
  kode?: string
  sku?: string
  currentStock?: number
}

/**
 * Batch with usage details
 */
export interface BatchWithUsage {
  id: string
  code: string
  date: Date | string
  description?: string | null
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  batchUsages: Array<{
    rawMaterial: RawMaterial
    rawMaterialId: string
    quantity: number
  }>
  batchFinishedGoods?: Array<{
    finishedGood: FinishedGood
    finishedGoodId: string
    quantity: number
  }>
}
