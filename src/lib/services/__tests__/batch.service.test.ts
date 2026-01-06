/**
 * Unit Tests for Batch Service
 *
 * Tests all service functions for batch operations
 * This is the most complex service with multi-table transactions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getBatches,
  getBatchById,
  createBatch,
  updateBatch,
  deleteBatch,
} from '../batch.service'
import { prisma } from '@/lib/db'
import {
  createTestBatch,
  createTestRawMaterial,
  createTestFinishedGood,
  createTestBatchUsage,
  createTestBatchFinishedGood,
} from '../../../../test/helpers/test-data'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
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
    stockMovement: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    rawMaterial: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    finishedGood: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((callback) => {
      const txClient = {
        batch: {
          create: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        },
        batchUsage: {
          create: vi.fn(),
          deleteMany: vi.fn(),
        },
        batchFinishedGood: {
          create: vi.fn(),
          deleteMany: vi.fn(),
        },
        stockMovement: {
          create: vi.fn(),
          deleteMany: vi.fn(),
        },
        rawMaterial: {
          update: vi.fn(),
        },
        finishedGood: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        drum: {
          findUnique: vi.fn(),
          findMany: vi.fn(),
          update: vi.fn(),
        },
        $queryRaw: vi.fn(),
      }
      return callback(txClient)
    }),
    $queryRaw: vi.fn(),
  },
}))

describe('Batch Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getBatches', () => {
    it('should return all batches when no pagination options provided', async () => {
      const mockBatches = [
        {
          ...createTestBatch({ id: '1', code: 'BATCH-001' }),
          batchFinishedGoods: [],
          batchUsages: [],
        },
        {
          ...createTestBatch({ id: '2', code: 'BATCH-002' }),
          batchFinishedGoods: [],
          batchUsages: [],
        },
      ]

      vi.mocked(prisma.batch.findMany).mockResolvedValue(mockBatches as any)

      const result = await getBatches()

      expect(result).toEqual(mockBatches)
      expect(prisma.batch.findMany).toHaveBeenCalledWith({
        select: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      })
    })

    it('should return paginated results when pagination options provided', async () => {
      const mockBatches = [
        {
          ...createTestBatch({ id: '1' }),
          batchFinishedGoods: [],
          batchUsages: [],
        },
      ]

      vi.mocked(prisma.batch.findMany).mockResolvedValue(mockBatches as any)
      vi.mocked(prisma.batch.count).mockResolvedValue(10)

      const result = await getBatches({ page: 1, limit: 5 })

      expect(result).toEqual({
        data: mockBatches,
        pagination: {
          page: 1,
          limit: 5,
          total: 10,
          totalPages: 2,
          hasMore: true,
        },
      })
    })
  })

  describe('getBatchById', () => {
    it('should return batch with relations when found', async () => {
      const mockBatch = {
        ...createTestBatch({ id: 'test-id' }),
        batchFinishedGoods: [
          {
            id: 'bfg-1',
            quantity: 10,
            finishedGood: createTestFinishedGood({ id: 'fg-1' }),
          },
        ],
        batchUsages: [
          {
            id: 'usage-1',
            quantity: 5,
            rawMaterial: createTestRawMaterial({ id: 'rm-1' }),
          },
        ],
      }

      vi.mocked(prisma.batch.findUnique).mockResolvedValue(mockBatch as any)

      const result = await getBatchById('test-id')

      expect(result).toEqual(mockBatch)
      expect(prisma.batch.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        include: expect.any(Object),
      })
    })

    it('should throw error when batch not found', async () => {
      vi.mocked(prisma.batch.findUnique).mockResolvedValue(null)

      await expect(getBatchById('non-existent')).rejects.toThrow(
        'Batch not found'
      )
    })
  })

  describe('createBatch', () => {
    it('should create batch with materials and finished goods', async () => {
      const input = {
        code: 'BATCH-001',
        date: new Date('2024-01-15'),
        description: 'Test batch',
        materials: [
          {
            rawMaterialId: 'rm-1',
            quantity: 10,
          },
        ],
        finishedGoods: [
          {
            finishedGoodId: 'fg-1',
            quantity: 5,
          },
        ],
      }

      const mockBatch = createTestBatch({ code: 'BATCH-001' })
      const mockRawMaterial = createTestRawMaterial({
        id: 'rm-1',
        name: 'Material 1',
        currentStock: 100,
      })
      const mockFinishedGood = createTestFinishedGood({ id: 'fg-1' })

      const mockTx = {
        batch: {
          create: vi.fn().mockResolvedValue(mockBatch),
        },
        batchUsage: {
          create: vi.fn().mockResolvedValue(createTestBatchUsage()),
        },
        batchFinishedGood: {
          create: vi.fn().mockResolvedValue(createTestBatchFinishedGood()),
        },
        stockMovement: {
          create: vi.fn().mockResolvedValue({
            id: 'movement-1',
            type: 'OUT',
            quantity: 10,
          }),
        },
        rawMaterial: {
          update: vi.fn().mockResolvedValue({
            ...mockRawMaterial,
            currentStock: 90,
          }),
        },
        finishedGood: {
          findUnique: vi.fn().mockResolvedValue(mockFinishedGood),
          update: vi.fn().mockResolvedValue({
            ...mockFinishedGood,
            currentStock: 5,
          }),
        },
        $queryRaw: vi.fn().mockResolvedValue([
          {
            id: 'rm-1',
            name: 'Material 1',
            currentStock: 100,
          },
        ]),
        drum: {
          findMany: vi.fn().mockResolvedValue([]), // No drums for legacy/auto test
        },
      }

      vi.mocked(prisma.batch.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.$transaction).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: any) => {
          return callback(mockTx)
        }
      )

      const result = await createBatch(input)

      expect(result).toEqual(mockBatch)
      expect(mockTx.batch.create).toHaveBeenCalledWith({
        data: {
          code: input.code,
          date: input.date,
          description: input.description,
          status: 'COMPLETED', // Status is COMPLETED when finished goods are provided
        },
      })
      expect(mockTx.batchUsage.create).toHaveBeenCalled()
      expect(mockTx.batchFinishedGood.create).toHaveBeenCalled()
      expect(mockTx.stockMovement.create).toHaveBeenCalledTimes(1) // OUT for material only
      expect(mockTx.rawMaterial.update).toHaveBeenCalledWith({
        where: { id: 'rm-1' },
        data: { currentStock: { decrement: 10 } },
      })
      // Decoupled logic: no finished good stock update
      expect(mockTx.finishedGood.update).not.toHaveBeenCalled()
    })

    it('should throw error when duplicate batch code exists', async () => {
      const input = {
        code: 'BATCH-001',
        date: new Date('2024-01-15'),
        materials: [],
        finishedGoods: [],
      }

      const existingBatch = createTestBatch({ code: 'BATCH-001' })
      vi.mocked(prisma.batch.findFirst).mockResolvedValue(existingBatch)

      await expect(createBatch(input)).rejects.toThrow(
        'Batch code "BATCH-001" already exists'
      )
    })

    it('should throw error when duplicate materials in batch', async () => {
      const input = {
        code: 'BATCH-001',
        date: new Date('2024-01-15'),
        materials: [
          { rawMaterialId: 'rm-1', quantity: 10 },
          { rawMaterialId: 'rm-1', quantity: 5 }, // Duplicate
        ],
        finishedGoods: [],
      }

      vi.mocked(prisma.batch.findFirst).mockResolvedValue(null)

      await expect(createBatch(input)).rejects.toThrow(
        'Duplicate materials found in batch'
      )
    })

    it('should throw error when duplicate finished goods in batch', async () => {
      const input = {
        code: 'BATCH-001',
        date: new Date('2024-01-15'),
        materials: [],
        finishedGoods: [
          { finishedGoodId: 'fg-1', quantity: 10 },
          { finishedGoodId: 'fg-1', quantity: 5 }, // Duplicate
        ],
      }

      vi.mocked(prisma.batch.findFirst).mockResolvedValue(null)

      await expect(createBatch(input)).rejects.toThrow(
        'Duplicate finished goods found in batch'
      )
    })

    it('should throw error when raw material not found', async () => {
      const input = {
        code: 'BATCH-001',
        date: new Date('2024-01-15'),
        materials: [{ rawMaterialId: 'non-existent', quantity: 10 }],
        finishedGoods: [],
      }

      const mockTx = {
        batch: { create: vi.fn() },
        batchUsage: { create: vi.fn() },
        batchFinishedGood: { create: vi.fn() },
        stockMovement: { create: vi.fn() },
        rawMaterial: { update: vi.fn() },
        finishedGood: { findUnique: vi.fn(), update: vi.fn() },
        $queryRaw: vi.fn().mockResolvedValue([]), // No material found
      }

      vi.mocked(prisma.batch.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.$transaction).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: any) => {
          return callback(mockTx)
        }
      )

      await expect(createBatch(input)).rejects.toThrow(
        'Raw material not found: non-existent'
      )
    })

    it('should throw error when insufficient stock', async () => {
      const input = {
        code: 'BATCH-001',
        date: new Date('2024-01-15'),
        materials: [{ rawMaterialId: 'rm-1', quantity: 150 }],
        finishedGoods: [],
      }

      const mockTx = {
        batch: { create: vi.fn() },
        batchUsage: { create: vi.fn() },
        batchFinishedGood: { create: vi.fn() },
        stockMovement: { create: vi.fn() },
        rawMaterial: { update: vi.fn() },
        finishedGood: { findUnique: vi.fn(), update: vi.fn() },
        $queryRaw: vi.fn().mockResolvedValue([
          {
            id: 'rm-1',
            name: 'Material 1',
            currentStock: 100, // Less than 150
          },
        ]),
      }

      vi.mocked(prisma.batch.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.$transaction).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: any) => {
          return callback(mockTx)
        }
      )

      await expect(createBatch(input)).rejects.toThrow('Insufficient stock')
    })

    it('should throw error when finished good not found', async () => {
      const input = {
        code: 'BATCH-001',
        date: new Date('2024-01-15'),
        materials: [],
        finishedGoods: [{ finishedGoodId: 'non-existent', quantity: 10 }],
      }

      const mockTx = {
        batch: { create: vi.fn() },
        batchUsage: { create: vi.fn() },
        batchFinishedGood: { create: vi.fn() },
        stockMovement: { create: vi.fn() },
        rawMaterial: { update: vi.fn() },
        finishedGood: {
          findUnique: vi.fn().mockResolvedValue(null), // Not found
          update: vi.fn(),
        },
        $queryRaw: vi.fn(),
      }

      vi.mocked(prisma.batch.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.$transaction).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: any) => {
          return callback(mockTx)
        }
      )

      await expect(createBatch(input)).rejects.toThrow(
        'Finished good not found: non-existent'
      )
    })

    it('should distribute material usage across drums FIFO when no drumId provided', async () => {
      const input = {
        code: 'BATCH-FIFO',
        date: new Date('2024-01-15'),
        materials: [{ rawMaterialId: 'rm-1', quantity: 150 }],
        finishedGoods: [],
      }

      const mockBatch = createTestBatch({ code: 'BATCH-FIFO' })
      const mockRawMaterial = createTestRawMaterial({
        id: 'rm-1',
        name: 'Material 1',
        currentStock: 200,
      })
      
      // Drums sorted by creation (FIFO)
      const mockDrums = [
        { id: 'drum-1', label: 'D1', currentQuantity: 100, createdAt: new Date('2024-01-01') },
        { id: 'drum-2', label: 'D2', currentQuantity: 100, createdAt: new Date('2024-01-02') },
      ]

      const mockTx = {
            batch: { create: vi.fn().mockResolvedValue(mockBatch) },
            batchUsage: { create: vi.fn() },
            batchFinishedGood: { create: vi.fn() },
            stockMovement: { create: vi.fn() },
            rawMaterial: { update: vi.fn() },
            finishedGood: { findUnique: vi.fn(), update: vi.fn() },
            drum: { 
                findMany: vi.fn().mockResolvedValue(mockDrums),
                findUnique: vi.fn().mockImplementation((args) => Promise.resolve(mockDrums.find(d => d.id === args.where.id))),
                update: vi.fn()
            },
            $queryRaw: vi.fn().mockResolvedValue([mockRawMaterial]),
      }

      vi.mocked(prisma.batch.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(mockTx))

      await createBatch(input)

      // Expect usage to be split: 100 from drum-1, 50 from drum-2
      expect(mockTx.drum.findMany).toHaveBeenCalled()
      
      // Drum 1 Usage (100)
      expect(mockTx.batchUsage.create).toHaveBeenCalledWith(expect.objectContaining({
          data: expect.objectContaining({ drumId: 'drum-1', quantity: 100 })
      }))
      expect(mockTx.drum.update).toHaveBeenCalledWith(expect.objectContaining({
          where: { id: 'drum-1' },
          data: expect.objectContaining({ currentQuantity: { decrement: 100 } })
      }))

      // Drum 2 Usage (50)
      expect(mockTx.batchUsage.create).toHaveBeenCalledWith(expect.objectContaining({
          data: expect.objectContaining({ drumId: 'drum-2', quantity: 50 })
      }))
      expect(mockTx.drum.update).toHaveBeenCalledWith(expect.objectContaining({
          where: { id: 'drum-2' },
          data: expect.objectContaining({ currentQuantity: { decrement: 50 } })
      }))
      
      // Total Material Deduction (150)
      expect(mockTx.rawMaterial.update).toHaveBeenCalledWith({
          where: { id: 'rm-1' },
          data: { currentStock: { decrement: 150 } }
      })
    })
  })

  describe('updateBatch', () => {
    it('should update batch and recalculate stock', async () => {
      const batchId = 'batch-1'
      const input = {
        code: 'BATCH-001-UPDATED',
        date: new Date('2024-01-16'),
        description: 'Updated batch',
        materials: [
          { rawMaterialId: 'rm-1', quantity: 15 }, // Changed from 10 to 15
        ],
        finishedGoods: [
          { finishedGoodId: 'fg-1', quantity: 8 }, // Changed from 5 to 8
        ],
      }

      const existingBatch = {
        ...createTestBatch({ id: batchId, code: 'BATCH-001' }),
        batchUsages: [
          createTestBatchUsage({
            id: 'usage-1',
            batchId,
            rawMaterialId: 'rm-1',
            quantity: 10,
          }),
        ],
        batchFinishedGoods: [
          createTestBatchFinishedGood({
            id: 'bfg-1',
            batchId,
            finishedGoodId: 'fg-1',
            quantity: 5,
          }),
        ],
      }

      const mockUpdatedBatch = {
        ...createTestBatch({ id: batchId, code: 'BATCH-001-UPDATED' }),
        batchFinishedGoods: [
          {
            id: 'bfg-1',
            quantity: 8,
            finishedGood: createTestFinishedGood({ id: 'fg-1' }),
          },
        ],
        batchUsages: [
          {
            id: 'usage-1',
            quantity: 15,
            rawMaterial: createTestRawMaterial({ id: 'rm-1' }),
          },
        ],
      }

      const mockTx = {
        batch: {
          update: vi.fn().mockResolvedValue(mockUpdatedBatch),
        },
        batchUsage: {
          create: vi.fn().mockResolvedValue(createTestBatchUsage()),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        batchFinishedGood: {
          create: vi.fn().mockResolvedValue(createTestBatchFinishedGood()),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        stockMovement: {
          create: vi.fn().mockResolvedValue({ id: 'movement-1' }),
          deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
        },
        rawMaterial: {
          update: vi.fn().mockResolvedValue({
            id: 'rm-1',
            currentStock: 95,
          }),
        },
        finishedGood: {
          findUnique: vi.fn().mockResolvedValue(createTestFinishedGood()),
          update: vi.fn().mockResolvedValue({
            id: 'fg-1',
            currentStock: 8,
          }),
        },
        $queryRaw: vi.fn()
          .mockResolvedValueOnce([
            {
              id: 'fg-1',
              name: 'Finished Good 1',
              currentStock: 5,
            },
          ])
          .mockResolvedValueOnce([
            {
              id: 'rm-1',
              name: 'Material 1',
              currentStock: 100,
            },
          ]),
        drum: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      }

      vi.mocked(prisma.batch.findUnique).mockResolvedValue(existingBatch as any)
      vi.mocked(prisma.batch.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.$transaction).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: any) => {
          return callback(mockTx)
        }
      )

      const result = await updateBatch(batchId, input)

      expect(result).toEqual(mockUpdatedBatch)
      // Should restore raw material stock (increment)
      expect(mockTx.rawMaterial.update).toHaveBeenCalledWith({
        where: { id: 'rm-1' },
        data: { currentStock: { increment: 10 } },
      })
      // Should NOT restore finished good stock (decoupled)
      expect(mockTx.finishedGood.update).not.toHaveBeenCalled()
      
      // Then apply new changes (materials only)
      expect(mockTx.rawMaterial.update).toHaveBeenCalledWith({
        where: { id: 'rm-1' },
        data: { currentStock: { decrement: 15 } },
      })
    })

    it('should throw error when batch not found', async () => {
      const input = {
        code: 'BATCH-001',
        date: new Date('2024-01-15'),
        materials: [],
        finishedGoods: [],
      }

      vi.mocked(prisma.batch.findUnique).mockResolvedValue(null)

      await expect(updateBatch('non-existent', input)).rejects.toThrow(
        'Batch not found'
      )
    })

    it('should throw error when duplicate code exists (excluding self)', async () => {
      const batchId = 'batch-1'
      const input = {
        code: 'BATCH-002',
        date: new Date('2024-01-15'),
        materials: [],
        finishedGoods: [],
      }

      const existingBatch = createTestBatch({ id: batchId })
      const duplicateBatch = createTestBatch({
        id: 'other-id',
        code: 'BATCH-002',
      })

      vi.mocked(prisma.batch.findUnique).mockResolvedValue(existingBatch as any)
      vi.mocked(prisma.batch.findFirst).mockResolvedValue(duplicateBatch)

      await expect(updateBatch(batchId, input)).rejects.toThrow(
        'Batch code "BATCH-002" already exists'
      )
    })

    it('should throw error when duplicate finished goods in update', async () => {
      const batchId = 'batch-1'
      const input = {
        code: 'BATCH-001',
        date: new Date('2024-01-15'),
        materials: [],
        finishedGoods: [
          { finishedGoodId: 'fg-1', quantity: 10 },
          { finishedGoodId: 'fg-1', quantity: 5 }, // Duplicate
        ],
      }

      const existingBatch = {
        ...createTestBatch({ id: batchId }),
        batchUsages: [],
        batchFinishedGoods: [],
      }

      vi.mocked(prisma.batch.findUnique).mockResolvedValue(existingBatch as any)
      vi.mocked(prisma.batch.findFirst).mockResolvedValue(null)

      await expect(updateBatch(batchId, input)).rejects.toThrow(
        'Duplicate finished goods found in batch'
      )
    })

    it('should throw error when duplicate materials in update', async () => {
      const batchId = 'batch-1'
      const input = {
        code: 'BATCH-001',
        date: new Date('2024-01-15'),
        materials: [
          { rawMaterialId: 'rm-1', quantity: 10 },
          { rawMaterialId: 'rm-1', quantity: 5 }, // Duplicate
        ],
        finishedGoods: [],
      }

      const existingBatch = {
        ...createTestBatch({ id: batchId }),
        batchUsages: [],
        batchFinishedGoods: [],
      }

      vi.mocked(prisma.batch.findUnique).mockResolvedValue(existingBatch as any)
      vi.mocked(prisma.batch.findFirst).mockResolvedValue(null)

      await expect(updateBatch(batchId, input)).rejects.toThrow(
        'Duplicate materials found in batch'
      )
    })

    it('should throw error when finished good not found in update', async () => {
      const batchId = 'batch-1'
      const input = {
        code: 'BATCH-001',
        date: new Date('2024-01-15'),
        materials: [],
        finishedGoods: [{ finishedGoodId: 'non-existent', quantity: 10 }],
      }

      const existingBatch = {
        ...createTestBatch({ id: batchId }),
        batchUsages: [],
        batchFinishedGoods: [],
      }

      const mockTx = {
        batch: { update: vi.fn() },
        batchUsage: { create: vi.fn(), deleteMany: vi.fn() },
        batchFinishedGood: { create: vi.fn(), deleteMany: vi.fn() },
        stockMovement: { create: vi.fn(), deleteMany: vi.fn() },
        rawMaterial: { update: vi.fn() },
        finishedGood: { findUnique: vi.fn(), update: vi.fn() },
        $queryRaw: vi.fn().mockResolvedValue([]), // Not found
      }

      vi.mocked(prisma.batch.findUnique).mockResolvedValue(existingBatch as any)
      vi.mocked(prisma.batch.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.$transaction).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: any) => {
          return callback(mockTx)
        }
      )

      await expect(updateBatch(batchId, input)).rejects.toThrow(
        'Finished good not found: non-existent'
      )
    })

    it('should throw error when raw material not found in update', async () => {
      const batchId = 'batch-1'
      const input = {
        code: 'BATCH-001',
        date: new Date('2024-01-15'),
        materials: [{ rawMaterialId: 'non-existent', quantity: 10 }],
        finishedGoods: [],
      }

      const existingBatch = {
        ...createTestBatch({ id: batchId }),
        batchUsages: [],
        batchFinishedGoods: [],
      }

      const mockTx = {
        batch: { update: vi.fn() },
        batchUsage: { create: vi.fn(), deleteMany: vi.fn() },
        batchFinishedGood: { create: vi.fn(), deleteMany: vi.fn() },
        stockMovement: { create: vi.fn(), deleteMany: vi.fn() },
        rawMaterial: { update: vi.fn() },
        finishedGood: { findUnique: vi.fn(), update: vi.fn() },
        $queryRaw: vi.fn().mockResolvedValue([]), // Not found
      }

      vi.mocked(prisma.batch.findUnique).mockResolvedValue(existingBatch as any)
      vi.mocked(prisma.batch.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.$transaction).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: any) => {
          return callback(mockTx)
        }
      )

      await expect(updateBatch(batchId, input)).rejects.toThrow(
        'Raw material not found: non-existent'
      )
    })

    it('should throw error when insufficient stock in update', async () => {
      const batchId = 'batch-1'
      const input = {
        code: 'BATCH-001',
        date: new Date('2024-01-15'),
        materials: [{ rawMaterialId: 'rm-1', quantity: 150 }],
        finishedGoods: [],
      }

      const existingBatch = {
        ...createTestBatch({ id: batchId }),
        batchUsages: [],
        batchFinishedGoods: [],
      }

      const mockTx = {
        batch: { update: vi.fn() },
        batchUsage: { create: vi.fn(), deleteMany: vi.fn() },
        batchFinishedGood: { create: vi.fn(), deleteMany: vi.fn() },
        stockMovement: { create: vi.fn(), deleteMany: vi.fn() },
        rawMaterial: { update: vi.fn() },
        finishedGood: { findUnique: vi.fn(), update: vi.fn() },
        $queryRaw: vi.fn().mockResolvedValue([
          {
            id: 'rm-1',
            name: 'Material 1',
            currentStock: 100, // Less than 150
          },
        ]),
      }

      vi.mocked(prisma.batch.findUnique).mockResolvedValue(existingBatch as any)
      vi.mocked(prisma.batch.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.$transaction).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: any) => {
          return callback(mockTx)
        }
      )

      await expect(updateBatch(batchId, input)).rejects.toThrow(
        'Insufficient stock'
      )
    })
  })

  describe('deleteBatch', () => {
    it('should delete batch and restore all stock', async () => {
      const batchId = 'batch-1'
      const existingBatch = {
        ...createTestBatch({ id: batchId }),
        batchUsages: [
          createTestBatchUsage({
            batchId,
            rawMaterialId: 'rm-1',
            quantity: 10,
          }),
        ],
        batchFinishedGoods: [
          createTestBatchFinishedGood({
            batchId,
            finishedGoodId: 'fg-1',
            quantity: 5,
          }),
        ],
      }

      const mockTx = {
        batch: {
          delete: vi.fn().mockResolvedValue(existingBatch),
        },
        batchUsage: {
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        batchFinishedGood: {
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        stockMovement: {
          deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
        },
        rawMaterial: {
          update: vi.fn().mockResolvedValue({
            id: 'rm-1',
            currentStock: 110,
          }),
        },
        finishedGood: {
          update: vi.fn().mockResolvedValue({
            id: 'fg-1',
            currentStock: 45,
          }),
        },
        $queryRaw: vi.fn(),
      }

      vi.mocked(prisma.batch.findUnique).mockResolvedValue(existingBatch as any)
      vi.mocked(prisma.$transaction).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: any) => {
          return callback(mockTx)
        }
      )

      await deleteBatch(batchId)

      // Should restore raw material stock (increment)
      expect(mockTx.rawMaterial.update).toHaveBeenCalledWith({
        where: { id: 'rm-1' },
        data: { currentStock: { increment: 10 } },
      })
      // Should NOT restore finished good stock (decoupled)
      expect(mockTx.finishedGood.update).not.toHaveBeenCalled()
      expect(mockTx.stockMovement.deleteMany).toHaveBeenCalledWith({
        where: { batchId },
      })
      expect(mockTx.batch.delete).toHaveBeenCalledWith({
        where: { id: batchId },
      })
    })

    it('should throw error when batch not found', async () => {
      vi.mocked(prisma.batch.findUnique).mockResolvedValue(null)

      await expect(deleteBatch('non-existent')).rejects.toThrow(
        'Batch not found'
      )
    })
  })
})
