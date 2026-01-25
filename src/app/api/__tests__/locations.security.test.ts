
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '../locations/route'
import { PUT, DELETE } from '../locations/[id]/route'
import { getLocations, createLocation, updateLocation, deleteLocation } from '@/lib/services/location.service'
import { auth } from '@/auth'
import { canManageLocations, canDeleteLocations } from '@/lib/rbac'

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
    (action, role) => `Access denied: ${role} users cannot ${action}`
  ),
}))

describe('Locations API Security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockSession = {
    user: {
      id: 'user-1',
      role: 'ADMIN',
    },
  }

  describe('GET /api/locations', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
      expect(getLocations).not.toHaveBeenCalled()
    })

    it('should return 403 when user cannot manage locations', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { role: 'GUEST' } } as any)
      vi.mocked(canManageLocations).mockReturnValue(false)

      const response = await GET()

      expect(response.status).toBe(403)
      expect(getLocations).not.toHaveBeenCalled()
    })

    it('should return locations when authorized', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canManageLocations).mockReturnValue(true)
      vi.mocked(getLocations).mockResolvedValue([])

      const response = await GET()

      expect(response.status).toBe(200)
      expect(getLocations).toHaveBeenCalled()
    })
  })

  describe('POST /api/locations', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null)
      const request = new NextRequest('http://localhost:3000/api/locations', {
        method: 'POST',
        body: JSON.stringify({ name: 'Loc' }),
      })

      const response = await POST(request)
      expect(response.status).toBe(401)
      expect(createLocation).not.toHaveBeenCalled()
    })

    it('should return 403 when user cannot manage locations', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { role: 'GUEST' } } as any)
      vi.mocked(canManageLocations).mockReturnValue(false)
      const request = new NextRequest('http://localhost:3000/api/locations', {
        method: 'POST',
        body: JSON.stringify({ name: 'Loc' }),
      })

      const response = await POST(request)
      expect(response.status).toBe(403)
      expect(createLocation).not.toHaveBeenCalled()
    })
  })

  describe('DELETE /api/locations/[id]', () => {
    it('should return 403 when user can manage but NOT delete locations (e.g. Office Purchasing)', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { role: 'OFFICE_PURCHASING' } } as any)
      // Can manage...
      vi.mocked(canManageLocations).mockReturnValue(true)
      // ...but CANNOT delete
      vi.mocked(canDeleteLocations).mockReturnValue(false)

      const params = Promise.resolve({ id: 'loc-1' })
      const request = new NextRequest('http://localhost:3000/api/locations/loc-1', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params })

      expect(response.status).toBe(403)
      expect(deleteLocation).not.toHaveBeenCalled()
    })

    it('should allow ADMIN to delete', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { role: 'ADMIN' } } as any)
      vi.mocked(canDeleteLocations).mockReturnValue(true)

      const params = Promise.resolve({ id: 'loc-1' })
      const request = new NextRequest('http://localhost:3000/api/locations/loc-1', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params })

      expect(response.status).toBe(200)
      expect(deleteLocation).toHaveBeenCalledWith('loc-1')
    })
  })
})
