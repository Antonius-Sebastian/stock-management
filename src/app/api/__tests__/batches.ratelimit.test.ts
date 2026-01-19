import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../batches/route'
import { checkRateLimit, RateLimits } from '@/lib/rate-limit'
import { getIpAddress } from '@/lib/audit'
import { auth } from '@/auth'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/rate-limit', async () => {
  const actual = await vi.importActual('@/lib/rate-limit')
  return {
    ...actual,
    checkRateLimit: vi.fn(),
    createRateLimitHeaders: vi.fn().mockReturnValue({
      'X-RateLimit-Limit': '10',
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': '2023-01-01T00:00:00.000Z',
    }),
    RateLimits: {
      BATCH_CREATION: {
        limit: 200,
        windowMs: 60 * 60 * 1000,
        keyPrefix: 'batch:create',
      },
    },
  }
})

vi.mock('@/lib/audit', async () => {
  const actual = await vi.importActual('@/lib/audit')
  return {
    ...actual,
    getIpAddress: vi.fn(),
  }
})

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

// Mock other dependencies that POST calls to avoid errors
vi.mock('@/lib/rbac', () => ({
  canCreateBatches: vi.fn().mockReturnValue(true),
  getPermissionErrorMessage: vi.fn(),
}))
vi.mock('@/lib/validations', () => ({
  batchSchemaAPI: {
    parse: vi.fn().mockReturnValue({
      code: 'BATCH-001',
      date: new Date(),
      materials: [],
    }),
  },
}))
vi.mock('@/lib/services', () => ({
  createBatch: vi.fn().mockResolvedValue({ id: 'batch-1' }),
  getBatches: vi.fn(),
}))

// Mock prisma for audit logs
vi.mock('@/lib/db', () => ({
  prisma: {
    rawMaterial: { findUnique: vi.fn() },
  },
}))

describe('Batch API Rate Limiting', () => {
  const mockSession = {
    user: {
      id: 'user-1',
      name: 'Test User',
      role: 'ADMIN',
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockSession as any)
    vi.mocked(getIpAddress).mockReturnValue('127.0.0.1')
  })

  it('should allow request when rate limit is not exceeded', async () => {
    // Setup mock to return allowed
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 10,
      resetInMs: 60000,
      limit: 200,
    })

    const request = new NextRequest('http://localhost:3000/api/batches', {
      method: 'POST',
      body: JSON.stringify({
        code: 'BATCH-TEST',
        date: new Date().toISOString(),
        materials: [],
      }),
    })

    const response = await POST(request)

    // Verify rate limit was checked
    expect(checkRateLimit).toHaveBeenCalledWith(
      '127.0.0.1',
      RateLimits.BATCH_CREATION
    )

    // Should proceed to creation (mocked)
    expect(response.status).toBe(201)

    // Verify headers are set
    expect(response.headers.get('X-RateLimit-Limit')).toBe('10') // Mocked value
  })

  it('should return 429 when rate limit is exceeded', async () => {
    // Setup mock to return not allowed
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetInMs: 60000,
      limit: 200,
    })

    const request = new NextRequest('http://localhost:3000/api/batches', {
      method: 'POST',
      body: JSON.stringify({
        code: 'BATCH-TEST',
        date: new Date().toISOString(),
        materials: [],
      }),
    })

    const response = await POST(request)

    // Verify rate limit was checked
    expect(checkRateLimit).toHaveBeenCalledWith(
      '127.0.0.1',
      RateLimits.BATCH_CREATION
    )

    // Should return 429
    expect(response.status).toBe(429)
    const body = await response.json()
    expect(body).toEqual({ error: 'Too many requests' })

    // Verify headers are set
    expect(response.headers.get('X-RateLimit-Limit')).toBe('10') // Mocked value
  })
})
