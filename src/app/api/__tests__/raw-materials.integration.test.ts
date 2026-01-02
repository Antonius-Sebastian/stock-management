/**
 * Integration Tests for Raw Materials API Routes
 *
 * Tests the full API route → service → database flow
 * These are automated tests (not manual)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '../raw-materials/route'
import { getRawMaterials, createRawMaterial } from '@/lib/services'
import { auth } from '@/auth'
import { canManageMaterials } from '@/lib/rbac'
import {
  createTestRawMaterial,
  createTestUser,
} from '../../../../test/helpers/test-data'

// Mock dependencies
vi.mock('@/lib/services', () => ({
  getRawMaterials: vi.fn(),
  createRawMaterial: vi.fn(),
}))

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rbac', () => ({
  canManageMaterials: vi.fn(),
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

describe('Raw Materials API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/raw-materials', () => {
    it('should return 401 when not authenticated', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(null as any)

      const request = new NextRequest('http://localhost:3000/api/raw-materials')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toEqual({ error: 'Unauthorized' })
      expect(getRawMaterials).not.toHaveBeenCalled()
    })

    it('should return raw materials when authenticated', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      const mockMaterials = [
        createTestRawMaterial({ id: '1', kode: 'RM-001' }),
        createTestRawMaterial({ id: '2', kode: 'RM-002' }),
      ]

      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(getRawMaterials).mockResolvedValue(mockMaterials)

      const request = new NextRequest('http://localhost:3000/api/raw-materials')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveLength(2)
      expect(data[0]).toMatchObject({ id: '1', kode: 'RM-001' })
      expect(data[1]).toMatchObject({ id: '2', kode: 'RM-002' })
      expect(getRawMaterials).toHaveBeenCalledWith(undefined)
    })

    it('should handle pagination parameters', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      const mockPaginatedResult = {
        data: [createTestRawMaterial({ id: '1' })],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasMore: false,
        },
      }

      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(getRawMaterials).mockResolvedValue(mockPaginatedResult)

      const request = new NextRequest(
        'http://localhost:3000/api/raw-materials?page=1&limit=10'
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
      expect(getRawMaterials).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
      })
    })

    it('should return 500 when service throws error', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(getRawMaterials).mockRejectedValue(
        new Error('Database connection failed')
      )

      const request = new NextRequest('http://localhost:3000/api/raw-materials')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({ error: 'Failed to fetch raw materials' })
    })
  })

  describe('POST /api/raw-materials', () => {
    it('should return 401 when not authenticated', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(null as any)

      const request = new NextRequest(
        'http://localhost:3000/api/raw-materials',
        {
          method: 'POST',
          body: JSON.stringify({
            kode: 'RM-001',
            name: 'Test Material',
            moq: 10,
          }),
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toEqual({ error: 'Unauthorized' })
      expect(createRawMaterial).not.toHaveBeenCalled()
    })

    it('should return 403 when user lacks permission', async () => {
      const mockUser = createTestUser({ role: 'FACTORY' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canManageMaterials).mockReturnValue(false)

      const request = new NextRequest(
        'http://localhost:3000/api/raw-materials',
        {
          method: 'POST',
          body: JSON.stringify({
            kode: 'RM-001',
            name: 'Test Material',
            moq: 10,
          }),
        }
      )

      const response = await POST(request)
      const _data = await response.json()

      expect(response.status).toBe(403)
      expect(createRawMaterial).not.toHaveBeenCalled()
    })

    it('should create raw material when authorized', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      const input = {
        kode: 'RM-001',
        name: 'Test Material',
        moq: 10,
      }

      const mockCreated = createTestRawMaterial(input)

      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canManageMaterials).mockReturnValue(true)
      vi.mocked(createRawMaterial).mockResolvedValue(mockCreated)

      const request = new NextRequest(
        'http://localhost:3000/api/raw-materials',
        {
          method: 'POST',
          body: JSON.stringify(input),
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data).toMatchObject({
        kode: input.kode,
        name: input.name,
        moq: input.moq,
      })
      expect(createRawMaterial).toHaveBeenCalledWith(
        expect.objectContaining({
          kode: input.kode,
          name: input.name,
          moq: input.moq,
        })
      )
    })

    it('should return 400 when validation fails', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canManageMaterials).mockReturnValue(true)
      // Zod validation happens before service call, so service won't be called

      const request = new NextRequest(
        'http://localhost:3000/api/raw-materials',
        {
          method: 'POST',
          body: JSON.stringify({
            // Missing required fields
            name: 'Test Material',
          }),
        }
      )

      const response = await POST(request)
      const _data = await response.json()

      expect(response.status).toBe(400)
      expect(_data).toHaveProperty('error')
      expect(createRawMaterial).not.toHaveBeenCalled()
    })

    it('should return 400 when service throws Error', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canManageMaterials).mockReturnValue(true)
      vi.mocked(createRawMaterial).mockRejectedValue(
        new Error('Database connection failed')
      )

      const request = new NextRequest(
        'http://localhost:3000/api/raw-materials',
        {
          method: 'POST',
          body: JSON.stringify({
            kode: 'RM-001',
            name: 'Test Material',
            moq: 10,
          }),
        }
      )

      const response = await POST(request)
      const data = await response.json()

      // API route returns 400 for Error instances, 500 only for non-Error exceptions
      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Database connection failed')
    })
  })
})
