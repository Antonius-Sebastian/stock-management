import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../batches/route'
import { auth } from '@/auth'
import { canCreateBatches } from '@/lib/rbac'
import { checkRateLimit } from '@/lib/rate-limit'

// Mock dependencies
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rbac', () => ({
  canCreateBatches: vi.fn(),
  getPermissionErrorMessage: vi.fn(),
}))

vi.mock('@/lib/services', () => ({
  createBatch: vi.fn(),
}))

vi.mock('@/lib/validations', () => ({
  batchSchemaAPI: {
    parse: vi.fn().mockReturnValue({
      code: 'TEST-BATCH',
      date: new Date(),
      materials: [],
    }),
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
  RateLimits: {
    BATCH_CREATION: { limit: 10, windowMs: 1000 },
  },
  createRateLimitHeaders: vi
    .fn()
    .mockReturnValue({ 'X-RateLimit-Limit': '10' }),
}))

// Mock db import inside the route
vi.mock('@/lib/db', () => ({
  prisma: {
    rawMaterial: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/audit', () => ({
  AuditHelpers: {
    batchCreated: vi.fn(),
  },
  getIpAddress: vi.fn().mockReturnValue('127.0.0.1'),
}))

describe('Batches API Rate Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should enforce rate limits on batch creation', async () => {
    // Setup auth and permissions
    vi.mocked(auth).mockResolvedValue({
      user: { role: 'ADMIN', id: '1', name: 'Admin' },
    } as any)
    vi.mocked(canCreateBatches).mockReturnValue(true)

    // Setup rate limit to fail
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetInMs: 1000,
      limit: 10,
    })

    const request = new NextRequest('http://localhost:3000/api/batches', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const response = await POST(request)

    // Should be 429 Too Many Requests
    // This assertion will fail if rate limiting is not implemented
    expect(checkRateLimit).toHaveBeenCalled()
    expect(response.status).toBe(429)
  })
})
