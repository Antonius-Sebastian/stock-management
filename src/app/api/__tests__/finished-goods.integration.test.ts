/**
 * Integration Tests for Finished Goods API Routes
 *
 * Tests the full API route → service → database flow
 * These are automated tests (not manual)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '../finished-goods/route'
import { PUT, DELETE } from '../finished-goods/[id]/route'
import {
  getFinishedGoods,
  createFinishedGood,
  updateFinishedGood,
  deleteFinishedGood,
} from '@/lib/services'
import { auth } from '@/auth'
import { canManageFinishedGoods, canDeleteFinishedGoods } from '@/lib/rbac'
import {
  createTestFinishedGood,
  createTestUser,
} from '../../../../test/helpers/test-data'

// Mock dependencies
vi.mock('@/lib/services', () => ({
  getFinishedGoods: vi.fn(),
  createFinishedGood: vi.fn(),
  updateFinishedGood: vi.fn(),
  deleteFinishedGood: vi.fn(),
}))

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rbac', () => ({
  canManageFinishedGoods: vi.fn(),
  canDeleteFinishedGoods: vi.fn(),
  getPermissionErrorMessage: vi.fn(
    (action: string, role: string) =>
      `${role} role cannot ${action}. ADMIN or OFFICE required.`
  ),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

describe('Finished Goods API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/finished-goods', () => {
    it('should return 401 when not authenticated', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(null as any)

      const request = new NextRequest(
        'http://localhost:3000/api/finished-goods'
      )
      const response = await GET(request)
      const _data = await response.json()

      expect(response.status).toBe(401)
      expect(_data).toHaveProperty('error')
      expect(getFinishedGoods).not.toHaveBeenCalled()
    })

    it('should return finished goods when authenticated', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      const mockFinishedGoods = [
        createTestFinishedGood({ id: '1', name: 'Product 1' }),
        createTestFinishedGood({ id: '2', name: 'Product 2' }),
      ]

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(getFinishedGoods).mockResolvedValue(mockFinishedGoods)

      const request = new NextRequest(
        'http://localhost:3000/api/finished-goods'
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ id: '1', name: 'Product 1' }),
        ]),
      })
      expect(getFinishedGoods).toHaveBeenCalled()
    })
  })

  describe('POST /api/finished-goods', () => {
    it('should return 401 when not authenticated', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(null as any)

      const request = new NextRequest(
        'http://localhost:3000/api/finished-goods',
        {
          method: 'POST',
          body: JSON.stringify({ name: 'New Product' }),
        }
      )

      const response = await POST(request)
      const _data = await response.json()

      expect(response.status).toBe(401)
      expect(createFinishedGood).not.toHaveBeenCalled()
    })

    it('should return 403 when user lacks permission', async () => {
      const mockUser = createTestUser({ role: 'FACTORY' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canManageFinishedGoods).mockReturnValue(false)

      const request = new NextRequest(
        'http://localhost:3000/api/finished-goods',
        {
          method: 'POST',
          body: JSON.stringify({ name: 'New Product' }),
        }
      )

      const response = await POST(request)
      const _data = await response.json()

      expect(response.status).toBe(403)
      expect(createFinishedGood).not.toHaveBeenCalled()
    })

    it('should create finished good when authorized', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      const input = { name: 'New Product' }
      const mockCreated = createTestFinishedGood(input)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canManageFinishedGoods).mockReturnValue(true)
      vi.mocked(createFinishedGood).mockResolvedValue(mockCreated)

      const request = new NextRequest(
        'http://localhost:3000/api/finished-goods',
        {
          method: 'POST',
          body: JSON.stringify(input),
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data).toMatchObject({
        success: true,
        data: expect.objectContaining({ name: 'New Product' }),
      })
      expect(createFinishedGood).toHaveBeenCalled()
    })
  })

  describe('PUT /api/finished-goods/[id]', () => {
    it('should update finished good when authorized', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      const input = { name: 'Updated Product' }
      const mockUpdated = createTestFinishedGood({ id: '123', ...input })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canManageFinishedGoods).mockReturnValue(true)
      vi.mocked(updateFinishedGood).mockResolvedValue(mockUpdated)

      const request = new NextRequest(
        'http://localhost:3000/api/finished-goods/123',
        {
          method: 'PUT',
          body: JSON.stringify(input),
        }
      )

      const response = await PUT(request, {
        params: Promise.resolve({ id: '123' }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({ name: 'Updated Product' })
      expect(updateFinishedGood).toHaveBeenCalled()
    })
  })

  describe('DELETE /api/finished-goods/[id]', () => {
    it('should delete finished good when authorized', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canDeleteFinishedGoods).mockReturnValue(true)
      vi.mocked(deleteFinishedGood).mockResolvedValue(undefined)

      const request = new NextRequest(
        'http://localhost:3000/api/finished-goods/123',
        {
          method: 'DELETE',
        }
      )

      const response = await DELETE(request, {
        params: Promise.resolve({ id: '123' }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('message')
      expect(deleteFinishedGood).toHaveBeenCalledWith('123')
    })
  })
})
