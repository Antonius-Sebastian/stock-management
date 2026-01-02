/**
 * Integration Tests for Raw Materials [id] API Routes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { PUT, DELETE } from '../raw-materials/[id]/route'
import { updateRawMaterial, deleteRawMaterial } from '@/lib/services'
import { auth } from '@/auth'
import { canManageMaterials, canDeleteMaterials } from '@/lib/rbac'
import {
  createTestRawMaterial,
  createTestUser,
} from '../../../../test/helpers/test-data'

vi.mock('@/lib/services', () => ({
  updateRawMaterial: vi.fn(),
  deleteRawMaterial: vi.fn(),
}))

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rbac', () => ({
  canManageMaterials: vi.fn(),
  canDeleteMaterials: vi.fn(),
  getPermissionErrorMessage: vi.fn(
    (action: string, role: string) => `${role} role cannot ${action}`
  ),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

describe('Raw Materials [id] API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('PUT /api/raw-materials/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(null as any)

      const request = new NextRequest(
        'http://localhost:3000/api/raw-materials/123',
        {
          method: 'PUT',
          body: JSON.stringify({
            kode: 'RM-001',
            name: 'Updated Material',
            moq: 20,
          }),
        }
      )

      const response = await PUT(request, {
        params: Promise.resolve({ id: '123' }),
      })
      const _data = await response.json()

      expect(response.status).toBe(401)
      expect(updateRawMaterial).not.toHaveBeenCalled()
    })

    it('should return 403 when user lacks permission', async () => {
      const mockUser = createTestUser({ role: 'FACTORY' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canManageMaterials).mockReturnValue(false)

      const request = new NextRequest(
        'http://localhost:3000/api/raw-materials/123',
        {
          method: 'PUT',
          body: JSON.stringify({
            kode: 'RM-001',
            name: 'Updated Material',
            moq: 20,
          }),
        }
      )

      const response = await PUT(request, {
        params: Promise.resolve({ id: '123' }),
      })
      const _data = await response.json()

      expect(response.status).toBe(403)
      expect(updateRawMaterial).not.toHaveBeenCalled()
    })

    it('should update raw material when authorized', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      const input = {
        kode: 'RM-001',
        name: 'Updated Material',
        moq: 20,
      }
      const mockUpdated = createTestRawMaterial({ id: '123', ...input })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canManageMaterials).mockReturnValue(true)
      vi.mocked(updateRawMaterial).mockResolvedValue(mockUpdated)

      const request = new NextRequest(
        'http://localhost:3000/api/raw-materials/123',
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
      expect(data).toMatchObject(input)
      expect(updateRawMaterial).toHaveBeenCalledWith('123', input)
    })
  })

  describe('DELETE /api/raw-materials/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(null as any)

      const request = new NextRequest(
        'http://localhost:3000/api/raw-materials/123',
        {
          method: 'DELETE',
        }
      )

      const response = await DELETE(request, {
        params: Promise.resolve({ id: '123' }),
      })
      const _data = await response.json()

      expect(response.status).toBe(401)
      expect(deleteRawMaterial).not.toHaveBeenCalled()
    })

    it('should return 403 when user lacks permission', async () => {
      const mockUser = createTestUser({ role: 'FACTORY' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canDeleteMaterials).mockReturnValue(false)

      const request = new NextRequest(
        'http://localhost:3000/api/raw-materials/123',
        {
          method: 'DELETE',
        }
      )

      const response = await DELETE(request, {
        params: Promise.resolve({ id: '123' }),
      })
      const _data = await response.json()

      expect(response.status).toBe(403)
      expect(deleteRawMaterial).not.toHaveBeenCalled()
    })

    it('should delete raw material when authorized', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canDeleteMaterials).mockReturnValue(true)
      vi.mocked(deleteRawMaterial).mockResolvedValue(undefined)

      const request = new NextRequest(
        'http://localhost:3000/api/raw-materials/123',
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
      expect(deleteRawMaterial).toHaveBeenCalledWith('123')
    })
  })
})
