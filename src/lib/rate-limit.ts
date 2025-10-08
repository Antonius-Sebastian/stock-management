/**
 * Rate Limiting Middleware
 * Simple in-memory rate limiter for API protection
 *
 * For production, consider using:
 * - Redis-based rate limiting (upstash/ratelimit)
 * - Edge rate limiting (Vercel/Cloudflare)
 * - API Gateway rate limiting
 */

import { logger } from '@/lib/logger'

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store (for development/simple deployments)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed within the window
   */
  limit: number

  /**
   * Time window in milliseconds
   */
  windowMs: number

  /**
   * Unique identifier for this rate limit (e.g., 'api:login', 'api:create-batch')
   */
  keyPrefix?: string
}

export interface RateLimitResult {
  /**
   * Whether the request should be allowed
   */
  allowed: boolean

  /**
   * Number of requests remaining in current window
   */
  remaining: number

  /**
   * Time in milliseconds until the rate limit resets
   */
  resetInMs: number

  /**
   * Total limit
   */
  limit: number
}

/**
 * Check if a request should be rate limited
 *
 * @param identifier - Unique identifier for the client (IP, user ID, etc.)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 *
 * @example
 * ```ts
 * const result = await checkRateLimit(ipAddress, {
 *   limit: 100,
 *   windowMs: 60 * 1000, // 1 minute
 *   keyPrefix: 'api:general'
 * })
 *
 * if (!result.allowed) {
 *   return NextResponse.json(
 *     { error: 'Too many requests' },
 *     {
 *       status: 429,
 *       headers: {
 *         'X-RateLimit-Limit': result.limit.toString(),
 *         'X-RateLimit-Remaining': '0',
 *         'X-RateLimit-Reset': new Date(Date.now() + result.resetInMs).toISOString()
 *       }
 *     }
 *   )
 * }
 * ```
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { limit, windowMs, keyPrefix = 'default' } = config
  const key = `${keyPrefix}:${identifier}`
  const now = Date.now()

  // Get or create entry
  let entry = rateLimitStore.get(key)

  if (!entry || entry.resetTime < now) {
    // Create new window
    entry = {
      count: 1,
      resetTime: now + windowMs,
    }
    rateLimitStore.set(key, entry)

    return {
      allowed: true,
      remaining: limit - 1,
      resetInMs: windowMs,
      limit,
    }
  }

  // Increment count
  entry.count++
  rateLimitStore.set(key, entry)

  const allowed = entry.count <= limit
  const remaining = Math.max(0, limit - entry.count)
  const resetInMs = entry.resetTime - now

  if (!allowed) {
    logger.warn('Rate limit exceeded', {
      identifier,
      keyPrefix,
      count: entry.count,
      limit,
    })
  }

  return {
    allowed,
    remaining,
    resetInMs,
    limit,
  }
}

/**
 * Preset rate limit configurations
 */
export const RateLimits = {
  /**
   * Login attempts: 5 per 15 minutes
   */
  LOGIN: {
    limit: 5,
    windowMs: 15 * 60 * 1000,
    keyPrefix: 'login',
  },

  /**
   * User creation: 10 per hour
   */
  USER_CREATION: {
    limit: 10,
    windowMs: 60 * 60 * 1000,
    keyPrefix: 'user:create',
  },

  /**
   * Batch creation: 50 per hour
   */
  BATCH_CREATION: {
    limit: 50,
    windowMs: 60 * 60 * 1000,
    keyPrefix: 'batch:create',
  },

  /**
   * General API: 100 requests per minute
   */
  API_GENERAL: {
    limit: 100,
    windowMs: 60 * 1000,
    keyPrefix: 'api:general',
  },

  /**
   * Report export: 10 per hour (expensive operation)
   */
  REPORT_EXPORT: {
    limit: 10,
    windowMs: 60 * 60 * 1000,
    keyPrefix: 'report:export',
  },
}

/**
 * Create rate limit response headers
 */
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(Date.now() + result.resetInMs).toISOString(),
  }
}
