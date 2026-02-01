import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '../locations/route'
import { PUT, DELETE } from '../locations/[id]/route'
import { getLocations, createLocation, updateLocation, deleteLocation } from '@/lib/services/location.service'
import { auth } from '@/auth'
import { canManageLocations, canDeleteLocations } from '@/lib/rbac'
import { createTestUser } from '../../../../test/helpers/test-data'

// Mock dependencies
vi.mock('@/lib/services/location.service', () => ({
  getLocations: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
  deleteLocation: vi.fn(),
}))

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rbac', () => ({
  canManageLocations: vi.fn(),
  canDeleteLocations: vi.fn(),
  getPermissionErrorMessage: vi.fn(
    (action: string, role: string) =>
      `${role} role cannot ${action}. Access denied.`
  ),
}))

describe('Locations API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/locations', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null as any)

      const response = await GET()
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data).toEqual({ error: 'Unauthorized' })
      expect(getLocations).not.toHaveBeenCalled()
    })

    it('should return locations when authenticated', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = { user: mockUser }
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(getLocations).mockResolvedValue([])

      const response = await GET()
      expect(response.status).toBe(200)
      expect(getLocations).toHaveBeenCalled()
    })
  })

  describe('POST /api/locations', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null as any)
      const request = new NextRequest('http://localhost:3000/api/locations', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Loc' }),
      })
      const response = await POST(request)
      expect(response.status).toBe(401)
      expect(createLocation).not.toHaveBeenCalled()
    })

    it('should return 403 when user lacks permission', async () => {
      const mockUser = createTestUser({ role: 'USER' }) // Assuming 'USER' doesn't have access
      const mockSession = { user: mockUser }
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canManageLocations).mockReturnValue(false)

      const request = new NextRequest('http://localhost:3000/api/locations', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Loc' }),
      })
      const response = await POST(request)
      expect(response.status).toBe(403)
      expect(createLocation).not.toHaveBeenCalled()
    })
  })

  describe('PUT /api/locations/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null as any)
      const request = new NextRequest('http://localhost:3000/api/locations/1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Loc' }),
      })
      const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })
      expect(response.status).toBe(401)
      expect(updateLocation).not.toHaveBeenCalled()
    })

    it('should return 403 when user lacks permission', async () => {
        const mockUser = createTestUser({ role: 'USER' })
        const mockSession = { user: mockUser }
        vi.mocked(auth).mockResolvedValue(mockSession as any)
        vi.mocked(canManageLocations).mockReturnValue(false)

        const request = new NextRequest('http://localhost:3000/api/locations/1', {
          method: 'PUT',
          body: JSON.stringify({ name: 'Updated Loc' }),
        })
        const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })
        expect(response.status).toBe(403)
        expect(updateLocation).not.toHaveBeenCalled()
      })
  })

  describe('DELETE /api/locations/[id]', () => {
    it('should return 401 when not authenticated', async () => {
        vi.mocked(auth).mockResolvedValue(null as any)
        const request = new NextRequest('http://localhost:3000/api/locations/1', {
          method: 'DELETE',
        })
        const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) })
        expect(response.status).toBe(401)
        expect(deleteLocation).not.toHaveBeenCalled()
    })

    it('should return 403 when user lacks permission', async () => {
        const mockUser = createTestUser({ role: 'OFFICE_WAREHOUSE' }) // Cannot delete
        const mockSession = { user: mockUser }
        vi.mocked(auth).mockResolvedValue(mockSession as any)
        vi.mocked(canDeleteLocations).mockReturnValue(false)

        const request = new NextRequest('http://localhost:3000/api/locations/1', {
          method: 'DELETE',
        })
        const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) })
        expect(response.status).toBe(403)
        expect(deleteLocation).not.toHaveBeenCalled()
      })
  })
})
