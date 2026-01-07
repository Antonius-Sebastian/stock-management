/**
 * Unit Tests for Raw Material Service
 *
 * Tests all service functions for raw material operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getRawMaterials,
  getRawMaterialById,
  createRawMaterial,
  updateRawMaterial,
  deleteRawMaterial,
  getRawMaterialMovements,
} from '../raw-material.service'
import { prisma } from '@/lib/db'
import {
  createTestRawMaterial,
  createTestStockMovement,
} from '../../../../test/helpers/test-data'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    rawMaterial: {
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

describe('Raw Material Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getRawMaterials', () => {
    it('should return all materials when no pagination options provided', async () => {
      const mockMaterials = [
        createTestRawMaterial({ id: '1', name: 'Material 1' }),
        createTestRawMaterial({ id: '2', name: 'Material 2' }),
      ]

      vi.mocked(prisma.rawMaterial.findMany).mockResolvedValue(mockMaterials)

      const result = await getRawMaterials()

      expect(result).toEqual(mockMaterials)
      expect(prisma.rawMaterial.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      })
      expect(prisma.rawMaterial.count).not.toHaveBeenCalled()
    })

    it('should return paginated results when pagination options provided', async () => {
      const mockMaterials = [
        createTestRawMaterial({ id: '1', name: 'Material 1' }),
        createTestRawMaterial({ id: '2', name: 'Material 2' }),
      ]

      vi.mocked(prisma.rawMaterial.findMany).mockResolvedValue(mockMaterials)
      vi.mocked(prisma.rawMaterial.count).mockResolvedValue(10)

      const result = await getRawMaterials({ page: 1, limit: 2 })

      expect(result).toEqual({
        data: mockMaterials,
        pagination: {
          page: 1,
          limit: 2,
          total: 10,
          totalPages: 5,
          hasMore: true,
        },
      })
      expect(prisma.rawMaterial.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 2,
        orderBy: { createdAt: 'desc' },
      })
      expect(prisma.rawMaterial.count).toHaveBeenCalled()
    })

    it('should enforce minimum page value of 1', async () => {
      const mockMaterials = [createTestRawMaterial()]
      vi.mocked(prisma.rawMaterial.findMany).mockResolvedValue(mockMaterials)
      vi.mocked(prisma.rawMaterial.count).mockResolvedValue(1)

      await getRawMaterials({ page: 0, limit: 10 })

      expect(prisma.rawMaterial.findMany).toHaveBeenCalledWith({
        skip: 0, // (1 - 1) * 10
        take: 10,
        orderBy: { createdAt: 'desc' },
      })
    })

    it('should enforce limit bounds (1-100)', async () => {
      const mockMaterials = [createTestRawMaterial()]
      vi.mocked(prisma.rawMaterial.findMany).mockResolvedValue(mockMaterials)
      vi.mocked(prisma.rawMaterial.count).mockResolvedValue(1)

      await getRawMaterials({ page: 1, limit: 200 })

      expect(prisma.rawMaterial.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 100, // Capped at 100
        orderBy: { createdAt: 'desc' },
      })
    })
  })

  describe('getRawMaterialById', () => {
    it('should return raw material when found', async () => {
      const mockMaterial = createTestRawMaterial({ id: 'test-id' })
      vi.mocked(prisma.rawMaterial.findUnique).mockResolvedValue(mockMaterial)

      const result = await getRawMaterialById('test-id')

      expect(result).toEqual(mockMaterial)
      expect(prisma.rawMaterial.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id' },
      })
    })

    it('should throw error when raw material not found', async () => {
      vi.mocked(prisma.rawMaterial.findUnique).mockResolvedValue(null)

      await expect(getRawMaterialById('non-existent')).rejects.toThrow(
        'Raw material not found'
      )
    })
  })

  describe('createRawMaterial', () => {
    it('should create raw material with valid data', async () => {
      const input = {
        kode: 'RM-001',
        name: 'Test Material',
        moq: 10,
      }
      const mockCreated = createTestRawMaterial(input)
      vi.mocked(prisma.rawMaterial.findFirst).mockResolvedValue(null) // No duplicate
      vi.mocked(prisma.rawMaterial.create).mockResolvedValue(mockCreated)

      const result = await createRawMaterial(input)

      expect(result).toEqual(mockCreated)
      expect(prisma.rawMaterial.findFirst).toHaveBeenCalledWith({
        where: { kode: 'RM-001' },
      })
      expect(prisma.rawMaterial.create).toHaveBeenCalledWith({
        data: {
          ...input,
          currentStock: 0,
        },
      })
    })

    it('should throw error when duplicate code exists', async () => {
      const input = {
        kode: 'RM-001',
        name: 'Test Material',
        moq: 10,
      }
      const existingMaterial = createTestRawMaterial({ kode: 'RM-001' })
      vi.mocked(prisma.rawMaterial.findFirst).mockResolvedValue(
        existingMaterial
      )

      await expect(createRawMaterial(input)).rejects.toThrow(
        'Material code "RM-001" already exists'
      )
      expect(prisma.rawMaterial.create).not.toHaveBeenCalled()
    })
  })

  describe('updateRawMaterial', () => {
    it('should update raw material with valid data', async () => {
      const existingMaterial = createTestRawMaterial({ id: 'test-id' })
      const updatedMaterial = createTestRawMaterial({
        id: 'test-id',
        name: 'Updated Name',
      })
      const input = {
        kode: 'RM-001',
        name: 'Updated Name',
        moq: 15,
      }

      vi.mocked(prisma.rawMaterial.findUnique).mockResolvedValue(
        existingMaterial
      )
      vi.mocked(prisma.rawMaterial.findFirst).mockResolvedValue(null) // No duplicate
      vi.mocked(prisma.rawMaterial.update).mockResolvedValue(updatedMaterial)

      const result = await updateRawMaterial('test-id', input)

      expect(result).toEqual(updatedMaterial)
      expect(prisma.rawMaterial.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id' },
      })
      expect(prisma.rawMaterial.update).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: input,
      })
    })

    it('should throw error when raw material not found', async () => {
      const input = {
        kode: 'RM-001',
        name: 'Test Material',
        moq: 10,
      }
      vi.mocked(prisma.rawMaterial.findUnique).mockResolvedValue(null)

      await expect(updateRawMaterial('non-existent', input)).rejects.toThrow(
        'Raw material not found'
      )
    })

    it('should throw error when duplicate code exists (excluding self)', async () => {
      const existingMaterial = createTestRawMaterial({ id: 'test-id' })
      const duplicateMaterial = createTestRawMaterial({
        id: 'other-id',
        kode: 'RM-001',
      })
      const input = {
        kode: 'RM-001',
        name: 'Test Material',
        moq: 10,
      }

      vi.mocked(prisma.rawMaterial.findUnique).mockResolvedValue(
        existingMaterial
      )
      vi.mocked(prisma.rawMaterial.findFirst).mockResolvedValue(
        duplicateMaterial
      )

      await expect(updateRawMaterial('test-id', input)).rejects.toThrow(
        'Material code "RM-001" already exists'
      )
    })
  })

  describe('deleteRawMaterial', () => {
    it('should delete raw material', async () => {
      const mockMaterial = createTestRawMaterial({ id: 'test-id' })
      vi.mocked(prisma.rawMaterial.findUnique).mockResolvedValue(mockMaterial)
      vi.mocked(prisma.rawMaterial.delete).mockResolvedValue(mockMaterial)

      await deleteRawMaterial('test-id')

      expect(prisma.rawMaterial.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id' },
      })
      expect(prisma.rawMaterial.delete).toHaveBeenCalledWith({
        where: { id: 'test-id' },
      })
    })

    it('should throw error when raw material not found', async () => {
      vi.mocked(prisma.rawMaterial.findUnique).mockResolvedValue(null)

      await expect(deleteRawMaterial('non-existent')).rejects.toThrow(
        'Raw material not found'
      )
      expect(prisma.rawMaterial.delete).not.toHaveBeenCalled()
    })
  })

  describe('getRawMaterialMovements', () => {
    it('should return movements with running balance', async () => {
      const materialId = 'test-id'
      const mockMaterial = {
        id: materialId,
        kode: 'RM-001',
        name: 'Test Material',
        currentStock: 25,
        moq: 10,
      }
      const mockMovements = [
        {
          ...createTestStockMovement({
            id: '1',
            type: 'IN',
            quantity: 10,
            date: new Date('2024-01-01'),
          }),
          batch: null,
          drum: null,
        },
        {
          ...createTestStockMovement({
            id: '2',
            type: 'OUT',
            quantity: 5,
            date: new Date('2024-01-02'),
          }),
          batch: null,
          drum: null,
        },
        {
          ...createTestStockMovement({
            id: '3',
            type: 'IN',
            quantity: 20,
            date: new Date('2024-01-03'),
          }),
          batch: null,
          drum: null,
        },
      ]

      vi.mocked(prisma.rawMaterial.findUnique).mockResolvedValue(
        mockMaterial as any
      )

      // Mock returns DESC (Newest First) as per new implementation expectation
      const mockMovementsDesc = [...mockMovements].reverse()

      vi.mocked(prisma.stockMovement.findMany).mockResolvedValue(
        mockMovementsDesc as any
      )

      const result = await getRawMaterialMovements(materialId)

      expect(result.material).toEqual(mockMaterial)
      expect(result.movements).toHaveLength(3)

      // Newest (Move 3)
      expect(result.movements[0].runningBalance).toBe(25)
      // Middle (Move 2)
      expect(result.movements[1].runningBalance).toBe(5)
      // Oldest (Move 1)
      expect(result.movements[2].runningBalance).toBe(10)

      expect(prisma.stockMovement.findMany).toHaveBeenCalledWith({
        where: { rawMaterialId: materialId },
        include: {
          batch: {
            select: {
              id: true,
              code: true,
            },
          },
          drum: {
            select: {
              label: true,
            },
          },
        },
        orderBy: { date: 'desc' },
        take: 500,
      })
    })

    it('should throw error when raw material not found', async () => {
      vi.mocked(prisma.rawMaterial.findUnique).mockResolvedValue(null)

      await expect(getRawMaterialMovements('non-existent')).rejects.toThrow(
        'Raw material not found'
      )
    })

    it('should handle ADJUSTMENT type correctly', async () => {
      const materialId = 'test-id'
      const mockMaterial = {
        id: materialId,
        kode: 'RM-001',
        name: 'Test Material',
        currentStock: 7,
        moq: 10,
      }
      const mockMovements = [
        {
          ...createTestStockMovement({
            id: '1',
            type: 'IN',
            quantity: 10,
          }),
          batch: null,
          drum: null,
        },
        {
          ...createTestStockMovement({
            id: '2',
            type: 'ADJUSTMENT',
            quantity: -3, // Negative adjustment
          }),
          batch: null,
          drum: null,
        },
      ]

      // Mock returns DESC
      const mockMovementsDesc = [...mockMovements].reverse()

      vi.mocked(prisma.rawMaterial.findUnique).mockResolvedValue(
        mockMaterial as any
      )
      vi.mocked(prisma.stockMovement.findMany).mockResolvedValue(
        mockMovementsDesc as any
      )

      const result = await getRawMaterialMovements(materialId)

      // 0: Move 2 (ADJ -3). After = 7. Before = 10.
      expect(result.movements[0].runningBalance).toBe(7)
      // 1: Move 1 (IN 10). After = 10. Before = 0.
      expect(result.movements[1].runningBalance).toBe(10)
    })
  })
})
