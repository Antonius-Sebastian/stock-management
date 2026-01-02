/**
 * Integration Tests for Users [id] API Routes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, PUT, DELETE } from '../users/[id]/route'
import { getUserById, updateUser, deleteUser } from '@/lib/services'
import { auth } from '@/auth'
import { canManageUsers } from '@/lib/rbac'
import { createTestUser } from '../../../../test/helpers/test-data'
import { AuditHelpers } from '@/lib/audit'

vi.mock('@/lib/services', () => ({
  getUserById: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}))

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rbac', () => ({
  canManageUsers: vi.fn(),
  getPermissionErrorMessage: vi.fn(
    (action: string, role: string) => `${role} role cannot ${action}`
  ),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

vi.mock('@/lib/audit', () => ({
  AuditHelpers: {
    userDeleted: vi.fn().mockResolvedValue(undefined),
  },
  getIpAddress: vi.fn(() => '127.0.0.1'),
}))

describe('Users [id] API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/users/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(null as any)

      const request = new NextRequest('http://localhost:3000/api/users/123')
      const response = await GET(request, {
        params: Promise.resolve({ id: '123' }),
      })
      const _data = await response.json()

      expect(response.status).toBe(401)
      expect(getUserById).not.toHaveBeenCalled()
    })

    it('should return user when found', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      const mockFoundUser = createTestUser({ id: '123' })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canManageUsers).mockReturnValue(true)
      vi.mocked(getUserById).mockResolvedValue(mockFoundUser)

      const request = new NextRequest('http://localhost:3000/api/users/123')
      const response = await GET(request, {
        params: Promise.resolve({ id: '123' }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({ id: '123' })
      expect(getUserById).toHaveBeenCalledWith('123')
    })
  })

  describe('PUT /api/users/[id]', () => {
    it('should update user when authorized', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      const input = { name: 'Updated Name' }
      const mockUpdated = createTestUser({ id: '123', ...input })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canManageUsers).mockReturnValue(true)
      vi.mocked(updateUser).mockResolvedValue(mockUpdated)

      const request = new NextRequest('http://localhost:3000/api/users/123', {
        method: 'PUT',
        body: JSON.stringify(input),
      })

      const response = await PUT(request, {
        params: Promise.resolve({ id: '123' }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({ name: 'Updated Name' })
      expect(updateUser).toHaveBeenCalledWith('123', input)
    })
  })

  describe('DELETE /api/users/[id]', () => {
    it('should delete user when authorized', async () => {
      const mockUser = createTestUser({ role: 'ADMIN', id: 'admin-1' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      const mockUserToDelete = createTestUser({ id: '123' })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canManageUsers).mockReturnValue(true)
      vi.mocked(getUserById).mockResolvedValue(mockUserToDelete)
      vi.mocked(deleteUser).mockResolvedValue(undefined)

      const request = new NextRequest('http://localhost:3000/api/users/123', {
        method: 'DELETE',
      })

      const response = await DELETE(request, {
        params: Promise.resolve({ id: '123' }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('message')
      expect(deleteUser).toHaveBeenCalledWith('123', 'admin-1')
      expect(AuditHelpers.userDeleted).toHaveBeenCalled()
    })
  })
})
