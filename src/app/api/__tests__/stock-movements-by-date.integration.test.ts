/**
 * Integration Tests for Stock Movements By Date API Routes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { DELETE, PUT } from '../stock-movements/by-date/route'
import {
  deleteStockMovementsByDate,
  updateStockMovementsByDate,
} from '@/lib/services'
import { auth } from '@/auth'
import { canDeleteStockMovements, canEditStockMovements } from '@/lib/rbac'
import { createTestUser } from '../../../../test/helpers/test-data'

vi.mock('@/lib/services', () => ({
  deleteStockMovementsByDate: vi.fn(),
  updateStockMovementsByDate: vi.fn(),
}))

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rbac', () => ({
  canDeleteStockMovements: vi.fn(),
  canEditStockMovements: vi.fn(),
  getPermissionErrorMessage: vi.fn(
    (action: string, role: string) => `${role} role cannot ${action}`
  ),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

describe('Stock Movements By Date API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('DELETE /api/stock-movements/by-date', () => {
    it('should return 401 when not authenticated', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(null as any)

      const request = new NextRequest(
        'http://localhost:3000/api/stock-movements/by-date?itemId=rm-1&date=2024-01-15&itemType=raw-material&movementType=IN',
        {
          method: 'DELETE',
        }
      )

      const response = await DELETE(request)
      const _data = await response.json()

      expect(response.status).toBe(401)
      expect(deleteStockMovementsByDate).not.toHaveBeenCalled()
    })

    it('should return 403 when user lacks permission', async () => {
      const mockUser = createTestUser({ role: 'FACTORY' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canDeleteStockMovements).mockReturnValue(false)

      const request = new NextRequest(
        'http://localhost:3000/api/stock-movements/by-date?itemId=rm-1&date=2024-01-15&itemType=raw-material&movementType=IN',
        {
          method: 'DELETE',
        }
      )

      const response = await DELETE(request)
      const _data = await response.json()

      expect(response.status).toBe(403)
      expect(deleteStockMovementsByDate).not.toHaveBeenCalled()
    })

    it('should delete stock movements when authorized', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canDeleteStockMovements).mockReturnValue(true)
      vi.mocked(deleteStockMovementsByDate).mockResolvedValue(undefined)

      const request = new NextRequest(
        'http://localhost:3000/api/stock-movements/by-date?itemId=rm-1&date=2024-01-15&itemType=raw-material&movementType=IN',
        {
          method: 'DELETE',
        }
      )

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('message')
      expect(deleteStockMovementsByDate).toHaveBeenCalled()
    })
  })

  describe('PUT /api/stock-movements/by-date', () => {
    it('should return 401 when not authenticated', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(null as any)

      const request = new NextRequest(
        'http://localhost:3000/api/stock-movements/by-date',
        {
          method: 'PUT',
          body: JSON.stringify({
            itemId: 'rm-1',
            date: '2024-01-15',
            itemType: 'raw-material',
            movementType: 'IN',
            quantity: 15,
          }),
        }
      )

      const response = await PUT(request)
      const _data = await response.json()

      expect(response.status).toBe(401)
      expect(updateStockMovementsByDate).not.toHaveBeenCalled()
    })

    it('should return 403 when user lacks permission', async () => {
      const mockUser = createTestUser({ role: 'FACTORY' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canEditStockMovements).mockReturnValue(false)

      const request = new NextRequest(
        'http://localhost:3000/api/stock-movements/by-date',
        {
          method: 'PUT',
          body: JSON.stringify({
            itemId: 'rm-1',
            date: '2024-01-15',
            itemType: 'raw-material',
            movementType: 'IN',
            quantity: 15,
          }),
        }
      )

      const response = await PUT(request)
      const _data = await response.json()

      expect(response.status).toBe(403)
      expect(updateStockMovementsByDate).not.toHaveBeenCalled()
    })

    it('should update stock movements when authorized', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      const input = {
        itemId: 'rm-1',
        date: '2024-01-15',
        itemType: 'raw-material' as const,
        movementType: 'IN' as const,
        quantity: 15,
      }

      const mockResult = {
        oldTotal: 10,
        newTotal: 15,
        difference: 5,
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canEditStockMovements).mockReturnValue(true)
      vi.mocked(updateStockMovementsByDate).mockResolvedValue(mockResult)

      const request = new NextRequest(
        'http://localhost:3000/api/stock-movements/by-date',
        {
          method: 'PUT',
          body: JSON.stringify(input),
        }
      )

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('result')
      expect(updateStockMovementsByDate).toHaveBeenCalled()
    })
  })
})
