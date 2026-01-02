/**
 * Integration Tests for Raw Materials Movements API Routes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '../raw-materials/[id]/movements/route'
import { getRawMaterialMovements } from '@/lib/services'
import { auth } from '@/auth'
import {
  createTestUser,
  createTestStockMovement,
} from '../../../../test/helpers/test-data'

vi.mock('@/lib/services', () => ({
  getRawMaterialMovements: vi.fn(),
}))

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

describe('Raw Materials Movements API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/raw-materials/[id]/movements', () => {
    it('should return 401 when not authenticated', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(null as any)

      const validCuid = 'clxxxxxxxxxxxxxxxxxxxx'
      const request = new NextRequest(
        `http://localhost:3000/api/raw-materials/${validCuid}/movements`
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: validCuid }),
      })
      const _data = await response.json()

      expect(response.status).toBe(401)
      expect(getRawMaterialMovements).not.toHaveBeenCalled()
    })

    it('should return movements when authenticated', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      // Use a valid CUID format (CUIDs start with 'c' and are 25 chars)
      const validCuid = 'clxxxxxxxxxxxxxxxxxxxx'
      const mockResult = {
        material: {
          id: validCuid,
          kode: 'RM-001',
          name: 'Test Material',
          currentStock: 5,
          moq: 10,
        },
        movements: [
          {
            ...createTestStockMovement({
              id: '1',
              type: 'IN',
              quantity: 10,
              rawMaterialId: validCuid,
            }),
            runningBalance: 10,
            batch: null,
          },
          {
            ...createTestStockMovement({
              id: '2',
              type: 'OUT',
              quantity: 5,
              rawMaterialId: validCuid,
            }),
            runningBalance: 5,
            batch: null,
          },
        ],
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(getRawMaterialMovements).mockResolvedValue(mockResult as any)

      const request = new NextRequest(
        `http://localhost:3000/api/raw-materials/${validCuid}/movements`
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: validCuid }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('material')
      expect(data).toHaveProperty('movements')
      expect(data.movements).toHaveLength(2)
      expect(data.movements[0]).toHaveProperty('runningBalance')
      expect(getRawMaterialMovements).toHaveBeenCalledWith(validCuid)
    })

    it('should return 400 when ID format is invalid', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)

      const request = new NextRequest(
        'http://localhost:3000/api/raw-materials/invalid-id/movements'
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: 'invalid-id' }),
      })
      const _data = await response.json()

      expect(response.status).toBe(400)
      expect(getRawMaterialMovements).not.toHaveBeenCalled()
    })
  })
})
