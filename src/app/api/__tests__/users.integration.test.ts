/**
 * Integration Tests for Users API Routes
 *
 * Tests the full API route → service → database flow
 * These are automated tests (not manual)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '../users/route'
import { getUsers, createUser } from '@/lib/services'
import { auth } from '@/auth'
import { canManageUsers } from '@/lib/rbac'
import { createTestUser } from '../../../../test/helpers/test-data'
import { checkRateLimit, RateLimits, createRateLimitHeaders } from '@/lib/rate-limit'

// Mock dependencies
vi.mock('@/lib/services', () => ({
  getUsers: vi.fn(),
  createUser: vi.fn(),
}))

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rbac', () => ({
  canManageUsers: vi.fn(),
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
    userCreated: vi.fn().mockResolvedValue(undefined),
    logUserAction: vi.fn(),
  },
  getIpAddress: vi.fn(() => '127.0.0.1'),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
  RateLimits: {
    USER_CREATION: { limit: 50, windowMs: 60 * 60 * 1000, keyPrefix: 'user:create' },
  },
  createRateLimitHeaders: vi.fn(() => ({
    'X-RateLimit-Limit': '50',
    'X-RateLimit-Remaining': '49',
    'X-RateLimit-Reset': '1234567890',
  })),
}))

describe('Users API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock implementation for rate limiting (allowed)
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 49,
      resetInMs: 3600000,
      limit: 50,
    })
  })

  describe('GET /api/users', () => {
    it('should return 401 when not authenticated', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(null as any)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toEqual({ error: 'Unauthorized' })
      expect(getUsers).not.toHaveBeenCalled()
    })

    it('should return 403 when user is not ADMIN', async () => {
      const mockUser = createTestUser({ role: 'OFFICE_PURCHASING' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canManageUsers).mockReturnValue(false)

      const response = await GET()

      expect(response.status).toBe(403)
      expect(getUsers).not.toHaveBeenCalled()
    })

    it('should return users when ADMIN', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      const mockUsers = [
        createTestUser({ id: '1', username: 'admin' }),
        createTestUser({ id: '2', username: 'factory' }),
      ]

      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canManageUsers).mockReturnValue(true)
      vi.mocked(getUsers).mockResolvedValue(mockUsers)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveLength(2)
      expect(data[0]).toMatchObject({ id: '1', username: 'admin' })
      expect(data[1]).toMatchObject({ id: '2', username: 'factory' })
      expect(getUsers).toHaveBeenCalled()
    })
  })

  describe('POST /api/users', () => {
    it('should return 429 when rate limit exceeded', async () => {
      // Mock rate limit exceeded
      vi.mocked(checkRateLimit).mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetInMs: 1000,
        limit: 50,
      })

      const request = new NextRequest('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data).toEqual({ error: 'Too many user creation attempts. Please try again later.' })
      expect(checkRateLimit).toHaveBeenCalled()
      // Should stop before auth
      expect(auth).not.toHaveBeenCalled()
    })

    it('should return 401 when not authenticated', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(null as any)

      const request = new NextRequest('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          username: 'newuser',
          email: 'new@example.com',
          password: 'Password123',
          name: 'New User',
          role: 'OFFICE_PURCHASING',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toEqual({ error: 'Unauthorized' })
      expect(createUser).not.toHaveBeenCalled()
    })

    it('should return 403 when user is not ADMIN', async () => {
      const mockUser = createTestUser({ role: 'OFFICE_WAREHOUSE' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canManageUsers).mockReturnValue(false)

      const request = new NextRequest('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          username: 'newuser',
          email: 'new@example.com',
          password: 'Password123',
          name: 'New User',
          role: 'OFFICE_PURCHASING',
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(403)
      expect(createUser).not.toHaveBeenCalled()
    })

    it('should create user when ADMIN', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      const input = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'Password123',
        name: 'New User',
        role: 'OFFICE_PURCHASING' as const,
      }

      const mockCreated = createTestUser({
        ...input,
        id: 'new-id',
        password: 'hashed',
      })

      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canManageUsers).mockReturnValue(true)
      vi.mocked(createUser).mockResolvedValue(mockCreated)

      const request = new NextRequest('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify(input),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        username: input.username,
        email: input.email,
        name: input.name,
        role: input.role,
      })
      expect(createUser).toHaveBeenCalled()
      expect(checkRateLimit).toHaveBeenCalled()
    })

    it('should return 400 when validation fails', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canManageUsers).mockReturnValue(true)
      vi.mocked(createUser).mockRejectedValue(
        new Error('Validation failed: password must be at least 8 characters')
      )

      const request = new NextRequest('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          username: 'newuser',
          email: 'new@example.com',
          password: 'short', // Too short
          name: 'New User',
          role: 'OFFICE_PURCHASING',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error')
    })
  })
})
