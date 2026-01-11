/**
 * Service Layer Exports
 *
 * Central export point for all service functions
 * Import services from here: import { createRawMaterial } from '@/lib/services'
 */

// Raw Material Services
export * from './raw-material.service'

// Finished Good Services
export * from './finished-good.service'

// Batch Services
export * from './batch.service'

// Stock Movement Services
export {
  getStockMovementsByDate,
  createStockMovement,
  createDrumStockIn,
  deleteStockMovementsByDate,
  updateStockMovementsByDate,
  updateStockMovement,
  deleteStockMovement,
  calculateStockAtDate,
  type StockMovementInput,
  type DrumStockInInput,
} from './stock-movement.service'

// User Services
export * from './user.service'
