/**
 * Prisma Mock Helper
 * Provides utilities for creating mock Prisma client instances in tests
 */

import { vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'

/**
 * Create a mock Prisma client with all necessary methods
 */
export function createMockPrismaClient() {
  return {
    rawMaterial: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    finishedGood: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    stockMovement: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    batch: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    batchUsage: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    batchFinishedGood: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((callback) => {
      // Return a transaction client that has the same structure
      const txClient = createMockPrismaClient()
      return callback(txClient)
    }),
    $queryRaw: vi.fn(),
  } as unknown as PrismaClient
}

/**
 * Reset all mocks in a Prisma client
 */
export function resetPrismaMocks(
  mockPrisma: ReturnType<typeof createMockPrismaClient>
) {
  Object.values(mockPrisma).forEach((model) => {
    if (model && typeof model === 'object') {
      Object.values(model).forEach((method) => {
        if (vi.isMockFunction(method)) {
          method.mockReset()
        }
      })
    }
  })
}
