import { handlers } from '@/auth'
import { NextRequest, NextResponse } from 'next/server'
import {
  checkRateLimit,
  RateLimits,
  createRateLimitHeaders,
} from '@/lib/rate-limit'
import { getIpAddress } from '@/lib/audit'

export const GET = handlers.GET

export async function POST(req: NextRequest) {
  const ip = getIpAddress(req.headers) || 'unknown'

  // Rate limit login attempts
  const rateLimit = await checkRateLimit(ip, RateLimits.LOGIN)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again later.' },
      {
        status: 429,
        headers: createRateLimitHeaders(rateLimit),
      }
    )
  }

  return handlers.POST(req)
}
