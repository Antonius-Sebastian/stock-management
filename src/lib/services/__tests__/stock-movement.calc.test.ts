
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { calculateStockAtDate } from '../stock-movement.service'
import { prisma } from '@/lib/db'
import {
  createTestStockMovement,
} from '../../../../test/helpers/test-data'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    stockMovement: {
      findMany: vi.fn(),
    },
    rawMaterial: {
      findUnique: vi.fn(),
    },
    finishedGood: {
      findUnique: vi.fn(),
    },
    finishedGoodStock: {
      findUnique: vi.fn(),
    },
    drum: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((callback) => {
        // Mock the transaction client
        const txClient = {
            stockMovement: {
                findMany: vi.fn(),
            },
            rawMaterial: {
                findUnique: vi.fn(),
            },
            finishedGood: {
                findUnique: vi.fn(),
            },
            finishedGoodStock: {
                findUnique: vi.fn(),
            },
            drum: {
                findUnique: vi.fn(),
            },
        }
        // Store the mock to be accessible in tests if needed (bit hacky but works for simple case)
        // Better: let the test configure the global mocks and we forward them?
        // Actually, the service uses `tx` inside transaction.
        // We can just execute the callback with a mock tx object that returns what we want.

        // However, we need to control what the mock tx returns.
        // Let's rely on the fact that we can mock the implementation of $transaction to just run the callback
        // and we can pass a mock object that has pre-configured spies.

        return callback(txClient)
    }),
  },
}))

describe('calculateStockAtDate Optimization Test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should correctly calculate stock using reverse calculation strategy', async () => {
    const date = new Date('2024-01-05')
    const itemId = 'rm-1'
    const itemType = 'raw-material'

    // Scenario:
    // Stock at 2024-01-05 should be 75.
    // Future movements (>= 2024-01-05):
    // 1. 2024-01-06: IN 10.
    // Current Stock (Total): 85.

    // 1. Mock Current Stock
    const mockCurrentStock = { currentStock: 85 }

    // 2. Mock Future Movements
    const mockFutureMovements = [
      createTestStockMovement({ type: 'IN', quantity: 10, date: new Date('2024-01-06') }),
    ]

    // We need to intercept the $transaction call to provide our mocks
    // The service calls: prisma.$transaction(async (tx) => { ... })

    // We will spy on the mock implementation of $transaction we defined above
    const mockTx = {
        rawMaterial: {
            findUnique: vi.fn().mockResolvedValue(mockCurrentStock)
        },
        stockMovement: {
            findMany: vi.fn().mockResolvedValue(mockFutureMovements)
        },
        // Add others to avoid crash if called
        drum: { findUnique: vi.fn() },
        finishedGood: { findUnique: vi.fn() },
        finishedGoodStock: { findUnique: vi.fn() },
    }

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
    })

    const result = await calculateStockAtDate(itemId, itemType, date)

    expect(result).toBe(75) // 85 - 10 = 75

    // Verify it called with expected arguments (gte: startOfDay)
    expect(mockTx.stockMovement.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        date: expect.objectContaining({
          gte: expect.any(Date),
        }),
      }),
    }))

    // Check Date is correct (start of day)
    const calledDate = vi.mocked(mockTx.stockMovement.findMany).mock.calls[0][0]?.where?.date
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gteDate = (calledDate as any)?.gte
    expect(gteDate).toBeInstanceOf(Date)
  })

  it('should handle complex reverse calculation (IN, OUT, ADJUSTMENT)', async () => {
    const date = new Date('2024-01-05')
    const itemId = 'rm-1'
    const itemType = 'raw-material'

    // Scenario:
    // Current Stock: 100
    // Movements >= 2024-01-05:
    // 1. IN 20 (implies stock was 80 before)
    // 2. OUT 10 (implies stock was 90 before this OUT? No. 80 -> 100 (after IN 20). Then OUT 10 -> 90.)
    // Wait, order matters for stock level trace, but for reverse sum:
    // StockAtDate = Current - (IN - OUT + ADJ)
    // Current = 100.
    // IN = 20. OUT = 10. ADJ = -5.
    // StockAtDate = 100 - (20 - 10 - 5) = 100 - 5 = 95.

    // Let's verify trace:
    // Start (T): 95.
    // IN 20 -> 115.
    // OUT 10 -> 105.
    // ADJ -5 -> 100.
    // End (Current): 100.
    // Match.

    const mockCurrentStock = { currentStock: 100 }
    const mockFutureMovements = [
      createTestStockMovement({ type: 'IN', quantity: 20, date: new Date('2024-01-06') }),
      createTestStockMovement({ type: 'OUT', quantity: 10, date: new Date('2024-01-07') }),
      createTestStockMovement({ type: 'ADJUSTMENT', quantity: -5, date: new Date('2024-01-08') }),
    ]

    const mockTx = {
        rawMaterial: {
            findUnique: vi.fn().mockResolvedValue(mockCurrentStock)
        },
        stockMovement: {
            findMany: vi.fn().mockResolvedValue(mockFutureMovements)
        },
        drum: { findUnique: vi.fn() },
        finishedGood: { findUnique: vi.fn() },
        finishedGoodStock: { findUnique: vi.fn() },
    }

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
    })

    const result = await calculateStockAtDate(itemId, itemType, date)

    expect(result).toBe(95)
  })
})
