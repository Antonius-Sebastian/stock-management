/**
 * Integration Tests for Batches API Routes
 *
 * Tests the full API route → service → database flow
 * These are automated tests (not manual)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '../batches/route'
import { GET as GET_BY_ID, PUT, DELETE } from '../batches/[id]/route'
import {
  getBatches,
  getBatchById,
  createBatch,
  updateBatch,
  deleteBatch,
} from '@/lib/services'
import { auth } from '@/auth'
import { canCreateBatches, canEditBatches, canDeleteBatches } from '@/lib/rbac'
import {
  createTestBatch,
  createTestUser,
} from '../../../../test/helpers/test-data'

// Mock dependencies
vi.mock('@/lib/services', () => ({
  getBatches: vi.fn(),
  getBatchById: vi.fn(),
  createBatch: vi.fn(),
  updateBatch: vi.fn(),
  deleteBatch: vi.fn(),
}))

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rbac', () => ({
  canCreateBatches: vi.fn(),
  canEditBatches: vi.fn(),
  canDeleteBatches: vi.fn(),
  getPermissionErrorMessage: vi.fn(
    (action: string, role: string) =>
      `${role} role cannot ${action}. ADMIN required.`
  ),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

vi.mock('@/lib/audit', () => ({
  AuditHelpers: {
    batchCreated: vi.fn().mockResolvedValue(undefined),
    batchUpdated: vi.fn().mockResolvedValue(undefined),
    batchDeleted: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('Batches API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/batches', () => {
    it('should return 401 when not authenticated', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(null as any)

      const request = new NextRequest('http://localhost:3000/api/batches')
      const response = await GET(request)
      const _data = await response.json()

      expect(response.status).toBe(401)
      expect(_data).toEqual({ error: 'Unauthorized' })
      expect(getBatches).not.toHaveBeenCalled()
    })

    it('should return batches when authenticated', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(getBatches).mockResolvedValue(mockBatches)

      const request = new NextRequest('http://localhost:3000/api/batches')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveLength(2)
      expect(data[0]).toMatchObject({ id: '1', code: 'BATCH-001' })
      expect(getBatches).toHaveBeenCalledWith(undefined)
    })

    it('should handle pagination parameters', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      const mockPaginatedResult = {
        data: [
          {
            ...createTestBatch({ id: '1' }),
            batchFinishedGoods: [],
            batchUsages: [],
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasMore: false,
        },
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(getBatches).mockResolvedValue(mockPaginatedResult)

      const request = new NextRequest(
        'http://localhost:3000/api/batches?page=1&limit=10'
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        data: expect.arrayContaining([expect.objectContaining({ id: '1' })]),
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasMore: false,
        },
      })
      expect(getBatches).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
      })
    })
  })

  describe('POST /api/batches', () => {
    it('should return 401 when not authenticated', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(null as any)

      const request = new NextRequest('http://localhost:3000/api/batches', {
        method: 'POST',
        body: JSON.stringify({
          code: 'BATCH-001',
          date: '2024-01-15',
          materials: [],
          finishedGoods: [],
        }),
      })

      const response = await POST(request)
      const _data = await response.json()

      expect(response.status).toBe(401)
      expect(_data).toEqual({ error: 'Unauthorized' })
      expect(createBatch).not.toHaveBeenCalled()
    })

    it('should return 403 when user lacks permission', async () => {
      const mockUser = createTestUser({ role: 'FACTORY' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canCreateBatches).mockReturnValue(false)

      const request = new NextRequest('http://localhost:3000/api/batches', {
        method: 'POST',
        body: JSON.stringify({
          code: 'BATCH-001',
          date: '2024-01-15',
          materials: [],
          finishedGoods: [],
        }),
      })

      const response = await POST(request)
      const _data = await response.json()

      expect(response.status).toBe(403)
      expect(createBatch).not.toHaveBeenCalled()
    })

    it('should create batch when authorized', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      const input = {
        code: 'BATCH-001',
        date: '2024-01-15',
        description: 'Test batch',
        materials: [{ rawMaterialId: 'rm-1', quantity: 10 }],
        finishedGoods: [{ finishedGoodId: 'fg-1', quantity: 5 }],
      }

      const mockCreated = createTestBatch({ code: 'BATCH-001' })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canCreateBatches).mockReturnValue(true)
      vi.mocked(createBatch).mockResolvedValue(mockCreated)

      const request = new NextRequest('http://localhost:3000/api/batches', {
        method: 'POST',
        body: JSON.stringify(input),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data).toMatchObject({ code: 'BATCH-001' })
      expect(createBatch).toHaveBeenCalled()
    })
  })

  describe('GET /api/batches/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(null as any)

      const request = new NextRequest('http://localhost:3000/api/batches/123')
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: '123' }),
      })
      const _data = await response.json()

      expect(response.status).toBe(401)
      expect(_data).toEqual({ error: 'Unauthorized' })
      expect(getBatchById).not.toHaveBeenCalled()
    })

    it('should return batch when found', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      const mockBatch = {
        ...createTestBatch({ id: '123' }),
        batchFinishedGoods: [],
        batchUsages: [],
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(getBatchById).mockResolvedValue(mockBatch as any)

      const request = new NextRequest('http://localhost:3000/api/batches/123')
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: '123' }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({ id: '123' })
      expect(getBatchById).toHaveBeenCalledWith('123')
    })
  })

  describe('PUT /api/batches/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(null as any)

      const request = new NextRequest('http://localhost:3000/api/batches/123', {
        method: 'PUT',
        body: JSON.stringify({
          code: 'BATCH-001',
          date: '2024-01-15',
          materials: [],
          finishedGoods: [],
        }),
      })

      const response = await PUT(request, {
        params: Promise.resolve({ id: '123' }),
      })
      const _data = await response.json()

      expect(response.status).toBe(401)
      expect(updateBatch).not.toHaveBeenCalled()
    })

    it('should return 403 when user lacks permission', async () => {
      const mockUser = createTestUser({ role: 'FACTORY' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canEditBatches).mockReturnValue(false)

      const request = new NextRequest('http://localhost:3000/api/batches/123', {
        method: 'PUT',
        body: JSON.stringify({
          code: 'BATCH-001',
          date: '2024-01-15',
          materials: [],
          finishedGoods: [],
        }),
      })

      const response = await PUT(request, {
        params: Promise.resolve({ id: '123' }),
      })
      const _data = await response.json()

      expect(response.status).toBe(403)
      expect(updateBatch).not.toHaveBeenCalled()
    })

    it('should update batch when authorized', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      const input = {
        code: 'BATCH-001-UPDATED',
        date: '2024-01-16',
        materials: [{ rawMaterialId: 'rm-1', quantity: 15 }],
        finishedGoods: [{ finishedGoodId: 'fg-1', quantity: 8 }],
      }

      const mockUpdated = {
        ...createTestBatch({ id: '123', code: 'BATCH-001-UPDATED' }),
        batchFinishedGoods: [],
        batchUsages: [],
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canEditBatches).mockReturnValue(true)
      vi.mocked(updateBatch).mockResolvedValue(mockUpdated as any)

      const request = new NextRequest('http://localhost:3000/api/batches/123', {
        method: 'PUT',
        body: JSON.stringify(input),
      })

      const response = await PUT(request, {
        params: Promise.resolve({ id: '123' }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({ code: 'BATCH-001-UPDATED' })
      expect(updateBatch).toHaveBeenCalled()
    })
  })

  describe('DELETE /api/batches/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(null as any)

      const request = new NextRequest('http://localhost:3000/api/batches/123', {
        method: 'DELETE',
      })

      const response = await DELETE(request, {
        params: Promise.resolve({ id: '123' }),
      })
      const _data = await response.json()

      expect(response.status).toBe(401)
      expect(deleteBatch).not.toHaveBeenCalled()
    })

    it('should return 403 when user lacks permission', async () => {
      const mockUser = createTestUser({ role: 'FACTORY' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canDeleteBatches).mockReturnValue(false)

      const request = new NextRequest('http://localhost:3000/api/batches/123', {
        method: 'DELETE',
      })

      const response = await DELETE(request, {
        params: Promise.resolve({ id: '123' }),
      })
      const _data = await response.json()

      expect(response.status).toBe(403)
      expect(deleteBatch).not.toHaveBeenCalled()
    })

    it('should delete batch when authorized', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canDeleteBatches).mockReturnValue(true)
      vi.mocked(deleteBatch).mockResolvedValue(undefined)

      const request = new NextRequest('http://localhost:3000/api/batches/123', {
        method: 'DELETE',
      })

      const mockBatch = {
        ...createTestBatch({ id: '123' }),
        batchFinishedGoods: [
          {
            finishedGood: { name: 'Test FG' },
          },
        ],
      }

      vi.mocked(getBatchById).mockResolvedValue(mockBatch as any)

      const response = await DELETE(request, {
        params: Promise.resolve({ id: '123' }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('message')
      expect(deleteBatch).toHaveBeenCalledWith('123')
    })
  })
})
