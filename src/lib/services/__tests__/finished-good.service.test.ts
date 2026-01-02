/**
 * Unit Tests for Finished Good Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getFinishedGoods,
  getFinishedGoodById,
  createFinishedGood,
  updateFinishedGood,
  deleteFinishedGood,
} from '../finished-good.service'
import { prisma } from '@/lib/db'
import { createTestFinishedGood } from '../../../../test/helpers/test-data'

vi.mock('@/lib/db', () => ({
  prisma: {
    finishedGood: {
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
    },
  },
}))

describe('Finished Good Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getFinishedGoods', () => {
    it('should return all finished goods when no pagination options provided', async () => {
      const mockGoods = [
        createTestFinishedGood({ id: '1', name: 'Product 1' }),
        createTestFinishedGood({ id: '2', name: 'Product 2' }),
      ]

      vi.mocked(prisma.finishedGood.findMany).mockResolvedValue(mockGoods)

      const result = await getFinishedGoods()

      expect(result).toEqual(mockGoods)
      expect(prisma.finishedGood.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      })
    })

    it('should return paginated results when pagination options provided', async () => {
      const mockGoods = [createTestFinishedGood({ id: '1' })]
      vi.mocked(prisma.finishedGood.findMany).mockResolvedValue(mockGoods)
      vi.mocked(prisma.finishedGood.count).mockResolvedValue(5)

      const result = await getFinishedGoods({ page: 1, limit: 2 })

      expect(result).toEqual({
        data: mockGoods,
        pagination: {
          page: 1,
          limit: 2,
          total: 5,
          totalPages: 3,
          hasMore: true,
        },
      })
    })
  })

  describe('getFinishedGoodById', () => {
    it('should return finished good when found', async () => {
      const mockGood = createTestFinishedGood({ id: 'test-id' })
      vi.mocked(prisma.finishedGood.findUnique).mockResolvedValue(mockGood)

      const result = await getFinishedGoodById('test-id')

      expect(result).toEqual(mockGood)
    })

    it('should throw error when finished good not found', async () => {
      vi.mocked(prisma.finishedGood.findUnique).mockResolvedValue(null)

      await expect(getFinishedGoodById('non-existent')).rejects.toThrow(
        'Finished good not found'
      )
    })
  })

  describe('createFinishedGood', () => {
    it('should create finished good with valid data', async () => {
      const input = { name: 'Test Product' }
      const mockCreated = createTestFinishedGood(input)
      vi.mocked(prisma.finishedGood.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.finishedGood.create).mockResolvedValue(mockCreated)

      const result = await createFinishedGood(input)

      expect(result).toEqual(mockCreated)
      expect(prisma.finishedGood.create).toHaveBeenCalledWith({
        data: {
          ...input,
          currentStock: 0,
        },
      })
    })

    it('should throw error when duplicate name exists', async () => {
      const input = { name: 'Test Product' }
      const existing = createTestFinishedGood({ name: 'Test Product' })
      vi.mocked(prisma.finishedGood.findFirst).mockResolvedValue(existing)

      await expect(createFinishedGood(input)).rejects.toThrow(
        'Product "Test Product" already exists'
      )
    })
  })

  describe('updateFinishedGood', () => {
    it('should update finished good with valid data', async () => {
      const existing = createTestFinishedGood({ id: 'test-id' })
      const updated = createTestFinishedGood({ id: 'test-id', name: 'Updated' })
      const input = { name: 'Updated' }

      vi.mocked(prisma.finishedGood.findUnique).mockResolvedValue(existing)
      vi.mocked(prisma.finishedGood.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.finishedGood.update).mockResolvedValue(updated)

      const result = await updateFinishedGood('test-id', input)

      expect(result).toEqual(updated)
    })

    it('should throw error when finished good not found', async () => {
      vi.mocked(prisma.finishedGood.findUnique).mockResolvedValue(null)

      await expect(
        updateFinishedGood('non-existent', { name: 'Test' })
      ).rejects.toThrow('Finished good not found')
    })
  })

  describe('deleteFinishedGood', () => {
    it('should delete finished good when no movements or batches', async () => {
      const mockGood = {
        ...createTestFinishedGood({ id: 'test-id' }),
        _count: {
          stockMovements: 0,
          batchFinishedGoods: 0,
        },
      }
      vi.mocked(prisma.finishedGood.findUnique).mockResolvedValue(
        mockGood as unknown as typeof mockGood
      )
      vi.mocked(prisma.finishedGood.delete).mockResolvedValue(mockGood)

      await deleteFinishedGood('test-id')

      expect(prisma.finishedGood.delete).toHaveBeenCalledWith({
        where: { id: 'test-id' },
      })
    })

    it('should throw error when finished good not found', async () => {
      vi.mocked(prisma.finishedGood.findUnique).mockResolvedValue(null)

      await expect(deleteFinishedGood('non-existent')).rejects.toThrow(
        'Finished good not found'
      )
    })

    it('should throw error when movements exist', async () => {
      const mockGood = {
        ...createTestFinishedGood({ id: 'test-id' }),
        _count: {
          stockMovements: 1,
          batchFinishedGoods: 0,
        },
      }
      vi.mocked(prisma.finishedGood.findUnique).mockResolvedValue(
        mockGood as unknown as typeof mockGood
      )

      await expect(deleteFinishedGood('test-id')).rejects.toThrow(
        'Cannot delete finished good that has stock movements or has been produced in batches'
      )
    })
  })
})
