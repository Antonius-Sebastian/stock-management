import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '../locations/route'
import { getLocations, createLocation } from '@/lib/services/location.service'
import { auth } from '@/auth'
import { canManageLocations } from '@/lib/rbac'
import { createTestUser } from '../../../../test/helpers/test-data'

// Mock dependencies
vi.mock('@/lib/services/location.service', () => ({
  getLocations: vi.fn(),
  createLocation: vi.fn(),
}))

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rbac', () => ({
  canManageLocations: vi.fn(),
  getPermissionErrorMessage: vi.fn(
    (action: string, role: string) =>
      `Access denied: ${role} users cannot ${action}`
  ),
}))

describe('Locations API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/locations', () => {
    it('should return 401 when not authenticated', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(null as any)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toEqual({ error: 'Unauthorized' })
      expect(getLocations).not.toHaveBeenCalled()
    })

    it('should return locations when authenticated', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = { user: mockUser }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)

      const mockLocations = [{ id: '1', name: 'Warehouse A' }]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(getLocations).mockResolvedValue(mockLocations as any)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(mockLocations)
      expect(getLocations).toHaveBeenCalled()
    })
  })

  describe('POST /api/locations', () => {
    it('should return 401 when not authenticated', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(null as any)
      const request = new NextRequest('http://localhost:3000/api/locations', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Loc' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toEqual({ error: 'Unauthorized' })
      expect(createLocation).not.toHaveBeenCalled()
    })

    it('should return 403 when user is not authorized', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockUser = createTestUser({ role: 'GUEST' as any })
      const mockSession = { user: mockUser }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canManageLocations).mockReturnValue(false)

      const request = new NextRequest('http://localhost:3000/api/locations', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Loc' }),
      })

      const response = await POST(request)

      expect(response.status).toBe(403)
      expect(createLocation).not.toHaveBeenCalled()
    })

    it('should create location when authorized', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = { user: mockUser }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canManageLocations).mockReturnValue(true)

      const input = { name: 'New Loc', address: '123 St' }
      const created = { id: '1', ...input }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(createLocation).mockResolvedValue(created as any)

      const request = new NextRequest('http://localhost:3000/api/locations', {
        method: 'POST',
        body: JSON.stringify(input),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data).toEqual(created)
      expect(createLocation).toHaveBeenCalledWith(expect.objectContaining(input))
    })

    it('should return 400 when validation fails', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = { user: mockUser }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canManageLocations).mockReturnValue(true)

      const request = new NextRequest('http://localhost:3000/api/locations', {
        method: 'POST',
        body: JSON.stringify({ name: '' }), // Empty name
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
      expect(createLocation).not.toHaveBeenCalled()
    })
  })
})
