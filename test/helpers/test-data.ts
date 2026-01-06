/**
 * Test Data Factory
 * Provides factory functions for creating test data objects
 */

import type {
  RawMaterial,
  FinishedGood,
  User,
  StockMovement,
  Batch,
  BatchUsage,
  BatchFinishedGood,
} from '@prisma/client'

export function createTestRawMaterial(
  overrides?: Partial<RawMaterial>
): RawMaterial {
  return {
    id: 'raw-mat-1',
    kode: 'RM-001',
    name: 'Test Raw Material',
    moq: 10,
    currentStock: 100,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

export function createTestFinishedGood(
  overrides?: Partial<FinishedGood>
): FinishedGood {
  return {
    id: 'fg-1',
    name: 'Test Finished Good',
    currentStock: 50,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

export function createTestUser(overrides?: Partial<User>): User {
  return {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashedpassword',
    role: 'ADMIN',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

export function createTestStockMovement(
  overrides?: Partial<StockMovement>
): StockMovement {
  return {
    id: 'movement-1',
    type: 'IN',
    quantity: 10,
    date: new Date('2024-01-01'),
    description: 'Test movement',
    rawMaterialId: 'raw-mat-1',
    finishedGoodId: null,
    batchId: null,
    locationId: null,
    drumId: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

export function createTestBatch(overrides?: Partial<Batch>): Batch {
  return {
    id: 'batch-1',
    code: 'BATCH-001',
    date: new Date('2024-01-01'),
    description: 'Test batch',
    status: 'IN_PROGRESS',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

export function createTestBatchUsage(
  overrides?: Partial<BatchUsage>
): BatchUsage {
  return {
    id: 'usage-1',
    batchId: 'batch-1',
    rawMaterialId: 'raw-mat-1',
    drumId: null,
    quantity: 5,
    ...overrides,
  }
}

export function createTestBatchFinishedGood(
  overrides?: Partial<BatchFinishedGood>
): BatchFinishedGood {
  return {
    id: 'bfg-1',
    batchId: 'batch-1',
    finishedGoodId: 'fg-1',
    quantity: 10,
    ...overrides,
  }
}
