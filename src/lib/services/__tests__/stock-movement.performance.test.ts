
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateStockAtDate } from '../stock-movement.service'
import { prisma } from '@/lib/db'

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
  },
}))

describe('Stock Movement Performance Optimization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should use Reverse Calculation strategy (O(Recent)) instead of Sum History (O(History))', async () => {
    const itemId = 'item-123'
    const date = new Date('2024-05-10')

    // Scenario:
    // "History" (Sum of movements before date): would be 40.
    // "Current Stock": 60.
    // "Future" Movements (Date to Now): IN +10.
    //
    // If we use "Sum History" strategy:
    //   Result = 40.
    //
    // If we use "Reverse Calculation" strategy:
    //   Result = CurrentStock - FutureMovements
    //          = 60 - (+10)
    //          = 50.
    //
    // We want the result to be 50 to confirm we are using the new strategy.
    // (In a real consistent DB, these would match, but we use different mock values to distinguish the code path).

    // Mock Current Stock
    vi.mocked(prisma.rawMaterial.findUnique).mockResolvedValue({
      id: itemId,
      currentStock: 60,
    } as any)

    // Mock Movements
    // If the code asks for movements BEFORE date (old strategy), return "History" movements
    // If the code asks for movements AFTER date (new strategy), return "Future" movements
    vi.mocked(prisma.stockMovement.findMany).mockImplementation(async (args: any) => {
        const whereDate = args.where.date;

        // Check if query is looking for 'lt' (before) or 'gte' (after)
        if (whereDate.lt) {
            // Old Strategy: Sum History
            return [
                { type: 'IN', quantity: 40, date: new Date('2024-01-01') }
            ] as any;
        } else if (whereDate.gte) {
            // New Strategy: Reverse Calculation
            // Movement AFTER the date (e.g., today is 2024-05-20, query date is 2024-05-10)
            return [
                { type: 'IN', quantity: 10, date: new Date('2024-05-15') }
            ] as any;
        }
        return [];
    })

    const result = await calculateStockAtDate(itemId, 'raw-material', date)

    // Expect 50, proving we used the Reverse Calculation strategy
    expect(result).toBe(50)

    // Also verify we queried the correct table for current stock
    expect(prisma.rawMaterial.findUnique).toHaveBeenCalledWith({
        where: { id: itemId }
    })
  })
})
