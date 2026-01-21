/**
 * Integration Tests for Reports Export API Routes
 *
 * Tests the full API route for reports export including rate limiting
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '../reports/export/route'
import { auth } from '@/auth'
import { canExportReports } from '@/lib/rbac'
import { createTestUser } from '../../../../test/helpers/test-data'
import { checkRateLimit } from '@/lib/rate-limit'

// Mock dependencies
vi.mock('@/lib/db', () => ({
  prisma: {
    rawMaterial: {
      findMany: vi.fn(),
    },
    finishedGood: {
      findMany: vi.fn(),
    },
    location: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rbac', () => ({
  canExportReports: vi.fn(),
  getPermissionErrorMessage: vi.fn(
    (action: string, role: string) =>
      `${role} role cannot ${action}.`
  ),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('@/lib/audit', () => ({
  getIpAddress: vi.fn(() => '127.0.0.1'),
}))

// Mock rate limit
vi.mock('@/lib/rate-limit', () => ({
  RateLimits: {
    REPORT_EXPORT: {
      limit: 50,
      windowMs: 60 * 60 * 1000,
      keyPrefix: 'report:export',
    },
  },
  checkRateLimit: vi.fn().mockResolvedValue({
    allowed: true,
    remaining: 10,
    resetInMs: 1000,
    limit: 10,
  }),
  createRateLimitHeaders: vi.fn().mockReturnValue({}),
}))

describe('Reports Export API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 10,
      resetInMs: 1000,
      limit: 10,
    })
  })

  describe('GET /api/reports/export', () => {
    it('should return 401 when not authenticated', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth).mockResolvedValue(null as any)

      const request = new NextRequest(
        'http://localhost:3000/api/reports/export?year=2024&month=1&type=raw-materials'
      )
      const response = await GET(request)
      const _data = await response.json()

      expect(response.status).toBe(401)
    })

    it('should return 403 when user lacks permission', async () => {
      const mockUser = createTestUser({ role: 'OPERATOR' }) // Assuming operator cannot export?
      // Actually checking implementation of canExportReports might allow everyone?
      // Let's force mock to false to test 403

      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }

      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(canExportReports).mockReturnValue(false)

      const request = new NextRequest(
        'http://localhost:3000/api/reports/export?year=2024&month=1&type=raw-materials'
      )
      const response = await GET(request)

      expect(response.status).toBe(403)
    })

    it('should return 429 when rate limit exceeded', async () => {
      vi.mocked(checkRateLimit).mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetInMs: 1000,
        limit: 10,
      })

      const request = new NextRequest(
        'http://localhost:3000/api/reports/export?year=2024&month=1&type=raw-materials'
      )

      const response = await GET(request)
      expect(response.status).toBe(429)
    })
  })
})
