/**
 * Integration Tests for Stock Movements API Routes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '../stock-movements/route'
import { getStockMovementsByDate, createStockMovement } from '@/lib/services'
import { auth } from '@/auth'
import { canCreateStockMovement, canCreateStockAdjustment } from '@/lib/rbac'
import {
  createTestUser,
  createTestStockMovement,
} from '../../../../test/helpers/test-data'

vi.mock('@/lib/services', () => ({
  getStockMovementsByDate: vi.fn(),
  createStockMovement: vi.fn(),
}))

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rbac', () => ({
  canCreateStockMovement: vi.fn(),
  canCreateStockAdjustment: vi.fn(),
  getPermissionErrorMessage: vi.fn(
    (action: string, role: string) => `${role} role cannot ${action}`
  ),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

describe('Stock Movements API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/stock-movements', () => {
    it('should return 401 when not authenticated', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(null as any)

      const request = new NextRequest(
        'http://localhost:3000/api/stock-movements?itemId=rm-1&date=2024-01-15&itemType=raw-material'
      )

      const response = await GET(request)
      const _data = await response.json()

      expect(response.status).toBe(401)
      expect(getStockMovementsByDate).not.toHaveBeenCalled()
    })

    it('should return stock movements when authenticated', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      const mockMovements = [
        createTestStockMovement({
          id: '1',
          type: 'IN',
          quantity: 10,
          rawMaterialId: 'rm-1',
        }),
      ]

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(getStockMovementsByDate).mockResolvedValue(mockMovements)

      const request = new NextRequest(
        'http://localhost:3000/api/stock-movements?itemId=rm-1&date=2024-01-15&itemType=raw-material'
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveLength(1)
      expect(getStockMovementsByDate).toHaveBeenCalled()
    })
  })

  describe('POST /api/stock-movements', () => {
    it('should return 401 when not authenticated', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(null as any)

      const request = new NextRequest(
        'http://localhost:3000/api/stock-movements',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'IN',
            quantity: 10,
            date: '2024-01-15',
            rawMaterialId: 'rm-1',
          }),
        }
      )

      const response = await POST(request)
      const _data = await response.json()

      expect(response.status).toBe(401)
      expect(createStockMovement).not.toHaveBeenCalled()
    })

    it('should return 403 when user lacks permission for IN movement', async () => {
      const mockUser = createTestUser({ role: 'OFFICE_WAREHOUSE' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canCreateStockMovement).mockReturnValue(false)

      const request = new NextRequest(
        'http://localhost:3000/api/stock-movements',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'IN',
            quantity: 10,
            date: '2024-01-15',
            rawMaterialId: 'rm-1',
          }),
        }
      )

      const response = await POST(request)
      const _data = await response.json()

      expect(response.status).toBe(403)
      expect(createStockMovement).not.toHaveBeenCalled()
    })

    it('should return 403 when user lacks permission for ADJUSTMENT', async () => {
      const mockUser = createTestUser({ role: 'OFFICE_WAREHOUSE' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canCreateStockAdjustment).mockReturnValue(false)

      const request = new NextRequest(
        'http://localhost:3000/api/stock-movements',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'ADJUSTMENT',
            quantity: 10,
            date: '2024-01-15',
            rawMaterialId: 'rm-1',
          }),
        }
      )

      const response = await POST(request)
      const _data = await response.json()

      expect(response.status).toBe(403)
      expect(createStockMovement).not.toHaveBeenCalled()
    })

    it('should create stock movement when authorized', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      const input = {
        type: 'IN' as const,
        quantity: 10,
        date: '2024-01-15',
        rawMaterialId: 'rm-1',
        description: 'Test movement',
      }

      const mockCreated = createTestStockMovement({
        ...input,
        date: new Date('2024-01-15'),
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canCreateStockMovement).mockReturnValue(true)
      vi.mocked(createStockMovement).mockResolvedValue(mockCreated)

      const request = new NextRequest(
        'http://localhost:3000/api/stock-movements',
        {
          method: 'POST',
          body: JSON.stringify(input),
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data).toMatchObject({
        type: 'IN',
        quantity: 10,
      })
      expect(createStockMovement).toHaveBeenCalled()
    })
  })
})
