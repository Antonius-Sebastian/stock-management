/**
 * Unit Tests for Stock Movement Service
 *
 * Tests all service functions for stock movement operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getStockMovementsByDate,
  createStockMovement,
  deleteStockMovementsByDate,
  updateStockMovementsByDate,
} from '../stock-movement.service'
import { prisma } from '@/lib/db'
import {
  createTestRawMaterial,
  createTestFinishedGood,
  createTestStockMovement,
} from '../../../../test/helpers/test-data'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    stockMovement: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
      groupBy: vi.fn(),
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
      // Return a transaction client that has the same structure
      const txClient = {
        stockMovement: {
          create: vi.fn(),
          deleteMany: vi.fn(),
          updateMany: vi.fn(),
        },
        rawMaterial: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        finishedGood: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        drum: {
          aggregate: vi.fn().mockResolvedValue({ _sum: { currentQuantity: 0 } }),
          findUnique: vi.fn(),
          findFirst: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
        },
        batchUsage: {
          findFirst: vi.fn(),
          update: vi.fn(),
          deleteMany: vi.fn(),
        },
        $queryRaw: vi.fn(),
      }
      return callback(txClient)
    }),
    $queryRaw: vi.fn(),
  },
}))

describe('Stock Movement Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getStockMovementsByDate', () => {
    it('should return movements for raw material on specific date', async () => {
      const itemId = 'raw-mat-1'
      const date = new Date('2024-01-15')
      const mockMovements = [
        createTestStockMovement({
          id: '1',
          rawMaterialId: itemId,
          date: new Date('2024-01-15T10:00:00'),
        }),
        createTestStockMovement({
          id: '2',
          rawMaterialId: itemId,
          date: new Date('2024-01-15T14:00:00'),
        }),
      ]

      vi.mocked(prisma.stockMovement.findMany).mockResolvedValue(mockMovements)

      const result = await getStockMovementsByDate(itemId, 'raw-material', date)

      expect(result).toEqual(mockMovements)
      expect(prisma.stockMovement.findMany).toHaveBeenCalledWith({
        where: {
          date: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
          rawMaterialId: itemId,
        },
        orderBy: { createdAt: 'asc' },
      })
    })

    it('should return movements for finished good on specific date', async () => {
      const itemId = 'fg-1'
      const date = new Date('2024-01-15')
      const mockMovements = [
        createTestStockMovement({
          id: '1',
          finishedGoodId: itemId,
          rawMaterialId: null,
          date: new Date('2024-01-15T10:00:00'),
        }),
      ]

      vi.mocked(prisma.stockMovement.findMany).mockResolvedValue(mockMovements)

      const result = await getStockMovementsByDate(
        itemId,
        'finished-good',
        date
      )

      expect(result).toEqual(mockMovements)
      expect(prisma.stockMovement.findMany).toHaveBeenCalledWith({
        where: {
          date: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
          finishedGoodId: itemId,
        },
        orderBy: { createdAt: 'asc' },
      })
    })
  })

  describe('createStockMovement', () => {
    it('should create IN movement for raw material and update stock', async () => {
      const input = {
        type: 'IN' as const,
        quantity: 10,
        date: new Date('2024-01-15'),
        description: 'Stock in',
        rawMaterialId: 'raw-mat-1',
        finishedGoodId: null,
        batchId: null,
      }
      const mockMaterial = createTestRawMaterial({
        id: 'raw-mat-1',
        currentStock: 100,
      })
      const mockMovement = createTestStockMovement(input)

      const mockTx = {
        stockMovement: {
          create: vi.fn().mockResolvedValue(mockMovement),
        },
        rawMaterial: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ ...mockMaterial, currentStock: 110 }),
          update: vi.fn().mockResolvedValue({
            ...mockMaterial,
            currentStock: 110,
          }),
        },
        finishedGood: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        drum: {
          aggregate: vi
            .fn()
            .mockResolvedValue({ _sum: { currentQuantity: 110 } }),
        },
        $queryRaw: vi.fn().mockResolvedValue([
          {
            id: 'raw-mat-1',
            name: mockMaterial.name,
            currentStock: 100,
          },
        ]),
      }

      vi.mocked(prisma.$transaction).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: any) => {
          return callback(mockTx)
        }
      )

      const result = await createStockMovement(input)

      expect(result).toEqual(mockMovement)
      expect(mockTx.stockMovement.create).toHaveBeenCalledWith({
        data: input,
      })
      expect(mockTx.rawMaterial.update).toHaveBeenCalledWith({
        where: { id: 'raw-mat-1' },
        data: { currentStock: { increment: 10 } },
      })
    })

    it('should create OUT movement and validate sufficient stock', async () => {
      // Mock sufficient stock
      vi.mocked(prisma.stockMovement.groupBy).mockResolvedValue([
        { type: 'IN', _sum: { quantity: 100 } },
      ] as any)

      const input = {
        type: 'OUT' as const,
        quantity: 5,
        date: new Date('2024-01-15'),
        description: 'Stock out',
        rawMaterialId: 'raw-mat-1',
        finishedGoodId: null,
        batchId: null,
      }
      const mockMaterial = createTestRawMaterial({
        id: 'raw-mat-1',
        name: 'Test Material',
        currentStock: 100,
      })
      const mockMovement = createTestStockMovement(input)

      const mockTx = {
        stockMovement: {
          create: vi.fn().mockResolvedValue(mockMovement),
        },
        rawMaterial: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ ...mockMaterial, currentStock: 95 }),
          update: vi.fn().mockResolvedValue({
            ...mockMaterial,
            currentStock: 95,
          }),
        },
        finishedGood: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        drum: {
          aggregate: vi
            .fn()
            .mockResolvedValue({ _sum: { currentQuantity: 95 } }),
        },
        $queryRaw: vi.fn().mockResolvedValue([
          {
            id: 'raw-mat-1',
            name: 'Test Material',
            currentStock: 100,
          },
        ]),
      }

      vi.mocked(prisma.$transaction).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: any) => {
          return callback(mockTx)
        }
      )

      const result = await createStockMovement(input)

      expect(result).toEqual(mockMovement)
      expect(mockTx.rawMaterial.update).toHaveBeenCalledWith({
        where: { id: 'raw-mat-1' },
        data: { currentStock: { increment: -5 } },
      })
    })

    it('should throw error when insufficient stock for OUT movement', async () => {
      // Mock insufficient stock
      vi.mocked(prisma.stockMovement.groupBy).mockResolvedValue([
        { type: 'IN', _sum: { quantity: 100 } },
      ] as any)

      const input = {
        type: 'OUT' as const,
        quantity: 150,
        date: new Date('2024-01-15'),
        description: 'Stock out',
        rawMaterialId: 'raw-mat-1',
        finishedGoodId: null,
        batchId: null,
      }
      const mockMaterial = {
        id: 'raw-mat-1',
        name: 'Test Material',
        currentStock: 100,
      }

      const mockTx = {
        stockMovement: {
          create: vi.fn(),
        },
        rawMaterial: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        finishedGood: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        $queryRaw: vi.fn().mockResolvedValue([mockMaterial]),
      }

      vi.mocked(prisma.$transaction).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: any) => {
          return callback(mockTx)
        }
      )

      await expect(createStockMovement(input)).rejects.toThrow(
        'Insufficient stock'
      )
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled()
    })

    it('should create ADJUSTMENT movement (positive)', async () => {
      const input = {
        type: 'ADJUSTMENT' as const,
        quantity: 5,
        date: new Date('2024-01-15'),
        description: 'Stock adjustment',
        rawMaterialId: 'raw-mat-1',
        finishedGoodId: null,
        batchId: null,
      }
      const mockMaterial = createTestRawMaterial({
        id: 'raw-mat-1',
        currentStock: 100,
      })
      const mockMovement = createTestStockMovement(input)

      const mockTx = {
        stockMovement: {
          create: vi.fn().mockResolvedValue(mockMovement),
        },
        rawMaterial: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ ...mockMaterial, currentStock: 105 }),
          update: vi.fn().mockResolvedValue({
            ...mockMaterial,
            currentStock: 105,
          }),
        },
        finishedGood: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        drum: {
          aggregate: vi
            .fn()
            .mockResolvedValue({ _sum: { currentQuantity: 105 } }),
        },
        $queryRaw: vi.fn().mockResolvedValue([
          {
            id: 'raw-mat-1',
            name: mockMaterial.name,
            currentStock: 100,
          },
        ]),
      }

      vi.mocked(prisma.$transaction).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: any) => {
          return callback(mockTx)
        }
      )

      const result = await createStockMovement(input)

      expect(result).toEqual(mockMovement)
      expect(mockTx.rawMaterial.update).toHaveBeenCalledWith({
        where: { id: 'raw-mat-1' },
        data: { currentStock: { increment: 5 } },
      })
    })

    it('should create ADJUSTMENT movement (negative) and validate stock', async () => {
      // Mock sufficient stock
      vi.mocked(prisma.stockMovement.groupBy).mockResolvedValue([
        { type: 'IN', _sum: { quantity: 100 } },
      ] as any)

      const input = {
        type: 'ADJUSTMENT' as const,
        quantity: -5,
        date: new Date('2024-01-15'),
        description: 'Stock adjustment',
        rawMaterialId: 'raw-mat-1',
        finishedGoodId: null,
        batchId: null,
      }
      const mockMaterial = {
        id: 'raw-mat-1',
        name: 'Test Material',
        currentStock: 100,
      }
      const mockMovement = createTestStockMovement(input)

      const mockTx = {
        stockMovement: {
          create: vi.fn().mockResolvedValue(mockMovement),
        },
        rawMaterial: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ ...mockMaterial, currentStock: 95 }),
          update: vi.fn().mockResolvedValue({
            ...mockMaterial,
            currentStock: 95,
          }),
        },
        finishedGood: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        drum: {
          aggregate: vi
            .fn()
            .mockResolvedValue({ _sum: { currentQuantity: 95 } }),
        },
        $queryRaw: vi.fn().mockResolvedValue([mockMaterial]),
      }

      vi.mocked(prisma.$transaction).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: any) => {
          return callback(mockTx)
        }
      )

      const result = await createStockMovement(input)

      expect(result).toEqual(mockMovement)
      expect(mockTx.rawMaterial.update).toHaveBeenCalledWith({
        where: { id: 'raw-mat-1' },
        data: { currentStock: { increment: -5 } },
      })
    })

    it('should throw error when negative ADJUSTMENT would result in negative stock', async () => {
      // Mock insufficient stock
      vi.mocked(prisma.stockMovement.groupBy).mockResolvedValue([
        { type: 'IN', _sum: { quantity: 20 } },
      ] as any)

      const input = {
        type: 'ADJUSTMENT' as const,
        quantity: -150,
        date: new Date('2024-01-15'),
        description: 'Stock adjustment',
        rawMaterialId: 'raw-mat-1',
        finishedGoodId: null,
        batchId: null,
      }
      const mockMaterial = {
        id: 'raw-mat-1',
        name: 'Test Material',
        currentStock: 100,
      }

      const mockTx = {
        stockMovement: {
          create: vi.fn(),
        },
        rawMaterial: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        finishedGood: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        $queryRaw: vi.fn().mockResolvedValue([mockMaterial]),
      }

      vi.mocked(prisma.$transaction).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: any) => {
          return callback(mockTx)
        }
      )

      await expect(createStockMovement(input)).rejects.toThrow(
        'Insufficient stock'
      )
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled()
    })

    it('should create movement for finished good', async () => {
      const input = {
        type: 'IN' as const,
        quantity: 10,
        date: new Date('2024-01-15'),
        description: 'Stock in',
        rawMaterialId: null,
        finishedGoodId: 'fg-1',
        batchId: null,
      }
      const mockFinishedGood = createTestFinishedGood({
        id: 'fg-1',
        currentStock: 50,
      })
      const mockMovement = createTestStockMovement(input)

      const mockTx = {
        stockMovement: {
          create: vi.fn().mockResolvedValue(mockMovement),
        },
        rawMaterial: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        finishedGood: {
          findUnique: vi.fn().mockResolvedValue(mockFinishedGood),
          update: vi.fn().mockResolvedValue({
            ...mockFinishedGood,
            currentStock: 60,
          }),
        },
        $queryRaw: vi.fn(),
      }

      vi.mocked(prisma.$transaction).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: any) => {
          return callback(mockTx)
        }
      )

      const result = await createStockMovement(input)

      expect(result).toEqual(mockMovement)
      expect(mockTx.finishedGood.update).toHaveBeenCalledWith({
        where: { id: 'fg-1' },
        data: { currentStock: { increment: 10 } },
      })
    })
  })

  describe('deleteStockMovementsByDate', () => {
    it('should delete movements and restore stock for raw material', async () => {
      const itemId = 'raw-mat-1'
      const itemType = 'raw-material' as const
      const date = new Date('2024-01-15')
      const mockMaterial = createTestRawMaterial({
        id: itemId,
        currentStock: 100,
      })
      // Only IN movements should be returned when filtering by 'IN'
      const mockMovements = [
        createTestStockMovement({
          id: '1',
          type: 'IN',
          quantity: 10,
          rawMaterialId: itemId,
          date,
        }),
      ]

      const mockTx = {
        stockMovement: {
          findMany: vi.fn().mockResolvedValue(mockMovements),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        rawMaterial: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ ...mockMaterial, currentStock: 95 }),
          update: vi.fn().mockResolvedValue({
            ...mockMaterial,
            currentStock: 95, // 100 - 10 + 5 = 95
          }),
        },
        finishedGood: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        drum: {
          aggregate: vi
            .fn()
            .mockResolvedValue({ _sum: { currentQuantity: 95 } }),
        },
        $queryRaw: vi.fn().mockResolvedValue([
          {
            id: 'raw-mat-1',
            name: mockMaterial.name,
            currentStock: 100,
          },
        ]),
      }

      vi.mocked(prisma.$transaction).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: any) => {
          return callback(mockTx)
        }
      )

      await deleteStockMovementsByDate(itemId, itemType, date, 'IN')

      expect(mockTx.stockMovement.deleteMany).toHaveBeenCalled()
      expect(mockTx.rawMaterial.update).toHaveBeenCalledWith({
        where: { id: itemId },
        data: { currentStock: { increment: -10 } }, // Reverse IN movement
      })
    })

    it('should delete movements and restore stock for finished good', async () => {
      const itemId = 'fg-1'
      const itemType = 'finished-good' as const
      const date = new Date('2024-01-15')
      const mockFinishedGood = createTestFinishedGood({
        id: itemId,
        currentStock: 50,
      })
      const mockMovements = [
        createTestStockMovement({
          id: '1',
          type: 'IN',
          quantity: 10,
          finishedGoodId: itemId,
          rawMaterialId: null,
          date,
        }),
      ]

      const mockTx = {
        stockMovement: {
          findMany: vi.fn().mockResolvedValue(mockMovements),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        rawMaterial: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        finishedGood: {
          findUnique: vi.fn().mockResolvedValue(mockFinishedGood),
          update: vi.fn().mockResolvedValue({
            ...mockFinishedGood,
            currentStock: 40, // 50 - 10 = 40
          }),
        },
        $queryRaw: vi.fn().mockResolvedValue([
          {
            id: 'raw-mat-1',
            name: mockFinishedGood.name,
            currentStock: 50,
          },
        ]),
      }

      vi.mocked(prisma.$transaction).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: any) => {
          return callback(mockTx)
        }
      )

      await deleteStockMovementsByDate(itemId, itemType, date, 'IN')

      expect(mockTx.finishedGood.update).toHaveBeenCalledWith({
        where: { id: itemId },
        data: { currentStock: { increment: -10 } }, // Reverse IN movement
      })
    })
  })

  describe('updateStockMovementsByDate', () => {
    it('should throw error when multiple movements exist', async () => {
      const itemId = 'raw-mat-1'
      const itemType = 'raw-material' as const
      const date = new Date('2024-01-15')
      const movementType = 'IN' as const
      const newQuantity = 15

      const existingMovements = [
        {
          ...createTestStockMovement({
            id: '1',
            type: 'IN',
            quantity: 10,
            rawMaterialId: itemId,
            date,
          }),
          batch: { code: 'BATCH-001' },
        },
        {
          ...createTestStockMovement({
            id: '2',
            type: 'IN',
            quantity: 5,
            rawMaterialId: itemId,
            date,
          }),
          batch: null,
        },
      ]

      const mockTx = {
        stockMovement: {
          findMany: vi.fn().mockResolvedValue(existingMovements),
          deleteMany: vi.fn(),
          create: vi.fn(),
        },
        rawMaterial: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        finishedGood: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        $queryRaw: vi.fn(),
      }

      vi.mocked(prisma.$transaction).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: any) => {
          return callback(mockTx)
        }
      )

      await expect(
        updateStockMovementsByDate(
          itemId,
          itemType,
          date,
          movementType,
          newQuantity
        )
      ).rejects.toThrow('Cannot edit: 2 separate movements exist')
    })

    it('should delete movements when quantity is 0', async () => {
      const itemId = 'raw-mat-1'
      const itemType = 'raw-material' as const
      const date = new Date('2024-01-15')
      const movementType = 'IN' as const
      const newQuantity = 0

      const existingMovements = [
        {
          ...createTestStockMovement({
            id: '1',
            type: 'IN',
            quantity: 10,
            rawMaterialId: itemId,
            date,
          }),
          batch: null,
        },
      ]

      const mockTx = {
        stockMovement: {
          findMany: vi.fn().mockResolvedValue(existingMovements),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          create: vi.fn(),
        },
        rawMaterial: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        finishedGood: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        drum: {
          aggregate: vi
            .fn()
            .mockResolvedValue({ _sum: { currentQuantity: 0 } }),
        },
        $queryRaw: vi.fn().mockResolvedValue([
          {
            id: 'raw-mat-1',
            name: 'Test Material',
            currentStock: 100,
          },
        ]),
      }

      vi.mocked(prisma.$transaction).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: any) => {
          return callback(mockTx)
        }
      )

      const result = await updateStockMovementsByDate(
        itemId,
        itemType,
        date,
        movementType,
        newQuantity
      )

      expect(result).toEqual({
        oldTotal: 10,
        newTotal: 0,
        difference: -10,
      })
      expect(mockTx.stockMovement.deleteMany).toHaveBeenCalled()
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled()
    })

    it('should update movements and recalculate stock for raw material', async () => {
      const itemId = 'raw-mat-1'
      const itemType = 'raw-material' as const
      const date = new Date('2024-01-15')
      const movementType = 'IN' as const
      const newQuantity = 15
      const mockMaterial = createTestRawMaterial({
        id: itemId,
        name: 'Test Material',
        currentStock: 100,
      })
      const existingMovements = [
        {
          ...createTestStockMovement({
            id: '1',
            type: 'IN',
            quantity: 10,
            rawMaterialId: itemId,
            date,
          }),
          batch: null,
        },
      ]

      const mockTx = {
        stockMovement: {
          findMany: vi.fn().mockResolvedValue(existingMovements),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          create: vi.fn().mockResolvedValue({
            ...existingMovements[0],
            quantity: newQuantity,
          }),
        },
        rawMaterial: {
          findUnique: vi.fn().mockResolvedValue(mockMaterial),
          update: vi.fn().mockResolvedValue(mockMaterial),
        },
        finishedGood: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        drum: {
          aggregate: vi
            .fn()
            .mockResolvedValue({ _sum: { currentQuantity: 100 } }),
        },
        $queryRaw: vi.fn().mockResolvedValue([
          {
            id: 'raw-mat-1',
            name: mockMaterial.name,
            currentStock: 100,
          },
        ]),
      }

      vi.mocked(prisma.$transaction).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: any) => {
          return callback(mockTx)
        }
      )

      const result = await updateStockMovementsByDate(
        itemId,
        itemType,
        date,
        movementType,
        newQuantity
      )

      expect(result).toEqual({
        oldTotal: 10,
        newTotal: 15,
        difference: 5,
      })
      expect(mockTx.stockMovement.deleteMany).toHaveBeenCalled()
      expect(mockTx.stockMovement.create).toHaveBeenCalled()
    })

    it('should throw error when raw material not found in update', async () => {
      const itemId = 'raw-mat-1'
      const itemType = 'raw-material' as const
      const date = new Date('2024-01-15')
      const movementType = 'IN' as const
      const newQuantity = 15

      const existingMovements = [
        {
          ...createTestStockMovement({
            id: '1',
            type: 'IN',
            quantity: 10,
            rawMaterialId: itemId,
            date,
          }),
          batch: null,
        },
      ]

      const mockTx = {
        stockMovement: {
          findMany: vi.fn().mockResolvedValue(existingMovements),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          create: vi.fn().mockResolvedValue({
            ...existingMovements[0],
            quantity: newQuantity,
          }),
        },
        rawMaterial: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        finishedGood: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        $queryRaw: vi.fn().mockResolvedValue([]), // Not found
      }

      vi.mocked(prisma.$transaction).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: any) => {
          return callback(mockTx)
        }
      )

      await expect(
        updateStockMovementsByDate(
          itemId,
          itemType,
          date,
          movementType,
          newQuantity
        )
      ).rejects.toThrow('Raw material not found')
    })

    it('should throw error when update would result in negative stock for raw material', async () => {
      const itemId = 'raw-mat-1'
      const itemType = 'raw-material' as const
      const date = new Date('2024-01-15')
      const movementType = 'OUT' as const
      const newQuantity = 150 // Would result in negative stock

      const existingMovements = [
        {
          ...createTestStockMovement({
            id: '1',
            type: 'OUT',
            quantity: 10,
            rawMaterialId: itemId,
            date,
          }),
          batch: null,
        },
      ]

      const mockTx = {
        stockMovement: {
          findMany: vi.fn().mockResolvedValue(existingMovements),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          create: vi.fn(),
        },
        rawMaterial: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        finishedGood: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        $queryRaw: vi.fn().mockResolvedValue([
          {
            id: 'raw-mat-1',
            name: 'Test Material',
            currentStock: 100,
          },
        ]),
      }

      vi.mocked(prisma.$transaction).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: any) => {
          return callback(mockTx)
        }
      )

      await expect(
        updateStockMovementsByDate(
          itemId,
          itemType,
          date,
          movementType,
          newQuantity
        )
      ).rejects.toThrow('would result in negative stock')
    })

    it('should update movements for finished good', async () => {
      const itemId = 'fg-1'
      const itemType = 'finished-good' as const
      const date = new Date('2024-01-15')
      const movementType = 'IN' as const
      const newQuantity = 15

      const existingMovements = [
        {
          ...createTestStockMovement({
            id: '1',
            type: 'IN',
            quantity: 10,
            finishedGoodId: itemId,
            rawMaterialId: null,
            date,
          }),
          batch: null,
        },
      ]

      const mockTx = {
        stockMovement: {
          findMany: vi.fn().mockResolvedValue(existingMovements),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          create: vi.fn().mockResolvedValue({
            ...existingMovements[0],
            quantity: newQuantity,
          }),
        },
        rawMaterial: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        finishedGood: {
          findUnique: vi.fn(),
          update: vi.fn().mockResolvedValue({
            id: 'fg-1',
            currentStock: 15,
          }),
        },
        $queryRaw: vi.fn().mockResolvedValue([
          {
            id: 'fg-1',
            name: 'Test Finished Good',
            currentStock: 50,
          },
        ]),
      }

      vi.mocked(prisma.$transaction).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: any) => {
          return callback(mockTx)
        }
      )

      const result = await updateStockMovementsByDate(
        itemId,
        itemType,
        date,
        movementType,
        newQuantity
      )

      expect(result).toEqual({
        oldTotal: 10,
        newTotal: 15,
        difference: 5,
      })
      expect(mockTx.finishedGood.update).toHaveBeenCalled()
    })

    it('should throw error when finished good not found in update', async () => {
      const itemId = 'fg-1'
      const itemType = 'finished-good' as const
      const date = new Date('2024-01-15')
      const movementType = 'IN' as const
      const newQuantity = 15

      const existingMovements = [
        {
          ...createTestStockMovement({
            id: '1',
            type: 'IN',
            quantity: 10,
            finishedGoodId: itemId,
            rawMaterialId: null,
            date,
          }),
          batch: null,
        },
      ]

      const mockTx = {
        stockMovement: {
          findMany: vi.fn().mockResolvedValue(existingMovements),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          create: vi.fn(),
        },
        rawMaterial: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        finishedGood: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        $queryRaw: vi.fn().mockResolvedValue([]), // Not found
      }

      vi.mocked(prisma.$transaction).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: any) => {
          return callback(mockTx)
        }
      )

      await expect(
        updateStockMovementsByDate(
          itemId,
          itemType,
          date,
          movementType,
          newQuantity
        )
      ).rejects.toThrow('Finished good not found')
    })

    it('should throw error when update would result in negative stock for finished good', async () => {
      const itemId = 'fg-1'
      const itemType = 'finished-good' as const
      const date = new Date('2024-01-15')
      const movementType = 'OUT' as const
      // const newQuantity = 60 // Would result in negative stock
      // oldTotal = 10, newTotal = 60, difference = 50
      // stockChange = -50 (OUT), currentStock = 50, newStock = 50 - 50 = 0 (not negative)
      // Need to use a larger quantity to actually go negative

      const existingMovements = [
        {
          ...createTestStockMovement({
            id: '1',
            type: 'OUT',
            quantity: 10,
            finishedGoodId: itemId,
            rawMaterialId: null,
            date,
          }),
          batch: null,
        },
      ]

      const mockTx = {
        stockMovement: {
          findMany: vi.fn().mockResolvedValue(existingMovements),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          create: vi.fn(),
        },
        rawMaterial: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        finishedGood: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        $queryRaw: vi.fn().mockResolvedValue([
          {
            id: 'fg-1',
            name: 'Test Finished Good',
            currentStock: 50,
          },
        ]),
      }

      vi.mocked(prisma.$transaction).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: any) => {
          return callback(mockTx)
        }
      )

      // oldTotal = 10, newTotal = 60, difference = 50
      // stockChange = -50 (OUT), currentStock = 50, newStock = 0 (not negative)
      // To get negative: need newStock < 0, so 50 + stockChange < 0
      // stockChange < -50, so difference > 50, so newQuantity > 60
      // Actually, let's recalculate: if currentStock = 50, oldTotal = 10 (OUT), newTotal = 70
      // difference = 70 - 10 = 60, stockChange = -60, newStock = 50 - 60 = -10 (negative!)
      const newQuantityNegative = 70

      await expect(
        updateStockMovementsByDate(
          itemId,
          itemType,
          date,
          movementType,
          newQuantityNegative
        )
      ).rejects.toThrow('would result in negative stock')
    })
  })

  describe('createDrumStockIn', () => {
    it('should create drums and movements with correct date for FIFO', async () => {
      const { createDrumStockIn } = await import('../stock-movement.service')
      const input = {
        rawMaterialId: 'rm-1',
        date: new Date('2024-01-01'), // Backdated
        description: 'Initial Stock',
        drums: [
          { label: 'D1', quantity: 100 },
          { label: 'D2', quantity: 100 },
        ],
      }

      const mockTx = {
        drum: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi
            .fn()
            .mockImplementation((args) =>
              Promise.resolve({ id: 'new-drum-id', ...args.data })
            ),
          aggregate: vi
            .fn()
            .mockResolvedValue({ _sum: { currentQuantity: 200 } }),
        },
        stockMovement: {
          create: vi.fn(),
        },
        rawMaterial: {
          update: vi.fn(),
          findUnique: vi.fn().mockResolvedValue({ currentStock: 200 }),
        },
        $queryRaw: vi.fn(),
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) =>
        callback(mockTx)
      )

      await createDrumStockIn(input)

      // Verify Drum Creation uses input DATE, not NOW
      expect(mockTx.drum.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            label: 'D1',
            createdAt: input.date,
          }),
        })
      )

      // Verify Movement Creation
      expect(mockTx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            date: input.date,
            type: 'IN',
            drumId: 'new-drum-id',
          }),
        })
      )

      // Verify Total Stock Update
      expect(mockTx.rawMaterial.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rm-1' },
          data: { currentStock: { increment: 200 } },
        })
      )
    })
  })
})
