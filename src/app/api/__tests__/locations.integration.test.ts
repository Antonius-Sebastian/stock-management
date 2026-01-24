/**
 * Integration Tests for Locations API Routes
 *
 * Tests the security of the locations API
 */

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
      `${role} role cannot ${action}. Access denied.`
  ),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
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

      expect(response.status).toBe(401)
      expect(getLocations).not.toHaveBeenCalled()
    })

    it('should return locations when authorized', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = { user: mockUser, expires: '2099-01-01' }
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canManageLocations).mockReturnValue(true)
      vi.mocked(getLocations).mockResolvedValue([{ id: 'loc-1', name: 'Factory' }])

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveLength(1)
      expect(getLocations).toHaveBeenCalled()
    })
  })

  describe('POST /api/locations', () => {
    it('should return 401 when not authenticated', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(null as any)

      const request = new NextRequest('http://localhost:3000/api/locations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Location',
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(401)
      expect(createLocation).not.toHaveBeenCalled()
    })

    it('should create location when authorized', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = { user: mockUser, expires: '2099-01-01' }
      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canManageLocations).mockReturnValue(true)
      vi.mocked(createLocation).mockResolvedValue({ id: 'loc-new', name: 'New Location' })

      const request = new NextRequest('http://localhost:3000/api/locations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Location',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.name).toBe('New Location')
      expect(createLocation).toHaveBeenCalled()
    })
  })
})
