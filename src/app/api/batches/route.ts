/**
 * Batch Management API
 *
 * Handles production batch tracking including:
 * - Listing batches with pagination
 * - Creating batches with automatic stock deduction
 * - Audit logging for compliance
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { canCreateBatches, getPermissionErrorMessage } from '@/lib/rbac'
import { logger } from '@/lib/logger'
import { AuditHelpers, getIpAddress } from '@/lib/audit'
import {
  checkRateLimit,
  RateLimits,
  createRateLimitHeaders,
} from '@/lib/rate-limit'
import { getBatches, createBatch, BatchInput } from '@/lib/services'
import { batchSchemaAPI } from '@/lib/validations'

/**
 * GET /api/batches
 *
 * List all production batches with optional pagination
 *
 * @param request - NextRequest with optional query params (page, limit)
 * @returns Paginated list of batches with metadata
 *
 * @remarks
 * - Requires authentication (all roles)
 * - Supports backward-compatible pagination via query params
 * - Returns batches with finished good and material details
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication required (all roles can view)
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse pagination parameters (optional - defaults to all)
    const { searchParams } = new URL(request.url)
    const pageParam = searchParams.get('page')
    const limitParam = searchParams.get('limit')

    // Prepare pagination options
    const options =
      pageParam || limitParam
        ? {
            page: pageParam ? parseInt(pageParam) : undefined,
            limit: limitParam ? parseInt(limitParam) : undefined,
          }
        : undefined

    // Get batches using service
    const result = await getBatches(options)

    return NextResponse.json(result)
  } catch (error) {
    logger.error('Error fetching batches', error)
    return NextResponse.json(
      { error: 'Failed to fetch batches' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/batches
 *
 * Create a new production batch
 *
 * @param request - NextRequest with batch data in body
 * @returns Created batch with details
 *
 * @remarks
 * - Requires ADMIN, OFFICE_PURCHASING, or OFFICE_WAREHOUSE role
 * - Automatically deducts raw material stock
 * - Creates stock movement records
 * - Validates sufficient stock before creation
 * - Prevents duplicate materials in same batch
 * - Logs audit trail for compliance
 *
 * @throws 401 - Unauthorized (not logged in)
 * @throws 403 - Forbidden (insufficient permissions)
 * @throws 400 - Validation error or insufficient stock
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting (IP-based)
    const ip = getIpAddress(request.headers) || '127.0.0.1'
    const rateLimit = await checkRateLimit(ip, RateLimits.BATCH_CREATION)

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: createRateLimitHeaders(rateLimit),
        }
      )
    }

    // Authentication and authorization required (ADMIN, OFFICE_PURCHASING, or OFFICE_WAREHOUSE)
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canCreateBatches(session.user.role)) {
      return NextResponse.json(
        {
          error: getPermissionErrorMessage('create batches', session.user.role),
        },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = batchSchemaAPI.parse(body)

    // Convert to service input format
    const batchInput: BatchInput = {
      code: validatedData.code,
      date: validatedData.date,
      description: validatedData.description || null,
      materials: validatedData.materials,
    }

    // Create batch using service
    const result = await createBatch(batchInput)

    // Audit log - fetch names for audit
    const { prisma } = await import('@/lib/db')
    const materials = []
    for (const m of validatedData.materials) {
      const material = await prisma.rawMaterial.findUnique({
        where: { id: m.rawMaterialId },
        select: { name: true },
      })
      const totalQuantity = m.drums.reduce(
        (sum, drum) => sum + drum.quantity,
        0
      )
      materials.push({ name: material?.name || 'Unknown', quantity: totalQuantity })
    }

    await AuditHelpers.batchCreated(validatedData.code, '', materials, {
      id: session.user.id,
      name: session.user.name || session.user.username,
      role: session.user.role,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    logger.error('Error creating batch', error)

    if (error instanceof z.ZodError) {
      const firstError = error.errors[0]
      return NextResponse.json(
        { error: firstError.message || 'Validation failed' },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to create batch' },
      { status: 500 }
    )
  }
}
