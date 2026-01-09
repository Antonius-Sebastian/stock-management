import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { auth } from '@/auth'
import { canViewReports, getPermissionErrorMessage } from '@/lib/rbac'
import { logger } from '@/lib/logger'
import { toWIB, getMonthRangeWIB, getWIBDate } from '@/lib/timezone'

const stockReportSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2030),
  month: z.coerce.number().int().min(1).max(12),
  type: z.enum(['raw-materials', 'finished-goods']),
  dataType: z.enum(['stok-awal', 'stok-masuk', 'stok-keluar', 'stok-sisa']),
  locationId: z.string().optional(), // Optional locationId for finished goods
})

export async function GET(request: NextRequest) {
  try {
    // Authentication and authorization required (all authenticated users can view reports)
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canViewReports(session.user.role)) {
      return NextResponse.json(
        { error: getPermissionErrorMessage('view reports', session.user.role) },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const query = {
      year: searchParams.get('year'),
      month: searchParams.get('month'),
      type: searchParams.get('type'),
      dataType: searchParams.get('dataType'),
      locationId: searchParams.get('locationId') || undefined,
    }

    const validatedQuery = stockReportSchema.parse(query)

    // Generate date range for the month in WIB timezone
    const { startDate, endDate, daysInMonth } = getMonthRangeWIB(
      validatedQuery.year,
      validatedQuery.month
    )

    // Only show data up to current date for current month, show all days for past months
    const today = getWIBDate()
    const isCurrentMonth =
      today.getFullYear() === validatedQuery.year &&
      today.getMonth() === validatedQuery.month - 1
    const isFutureMonth =
      validatedQuery.year > today.getFullYear() ||
      (validatedQuery.year === today.getFullYear() &&
        validatedQuery.month - 1 > today.getMonth())

    const currentDay = isCurrentMonth
      ? today.getDate()
      : isFutureMonth
        ? 0
        : daysInMonth

    // Get all items based on type
    const items =
      validatedQuery.type === 'raw-materials'
        ? await prisma.rawMaterial.findMany({
            include: {
              stockMovements: {
                orderBy: { date: 'asc' },
              },
            },
          })
        : await prisma.finishedGood.findMany({
            include: {
              stockMovements: {
                orderBy: { date: 'asc' },
              },
            },
          })

    // Track adjustments per item per day for visual indicators
    const adjustments: Record<string, Record<string, boolean>> = {}

    // Calculate stock data for each day
    const reportData = items.map((item) => {
      const itemData: Record<string, string | number> = {
        id: item.id,
        name: item.name,
        code: 'kode' in item ? (item as { kode?: string }).kode || '' : '',
      }

      // Initialize adjustments tracking for this item
      if (!adjustments[item.id]) {
        adjustments[item.id] = {}
      }

      // Filter movements by locationId for finished goods if provided
      let filteredMovements = item.stockMovements
      if (
        validatedQuery.type === 'finished-goods' &&
        validatedQuery.locationId
      ) {
        filteredMovements = item.stockMovements.filter(
          (movement) => movement.locationId === validatedQuery.locationId
        )
      }

      // Calculate opening stock at the start of the month
      // This is based on all movements BEFORE the start of the selected month
      // Convert movement dates to WIB for accurate comparison
      const movementsBeforeMonth = filteredMovements.filter((movement) => {
        const movementDate = toWIB(movement.date)
        return movementDate < startDate
      })

      let openingStock = 0
      for (const movement of movementsBeforeMonth) {
        if (movement.type === 'IN') {
          openingStock += movement.quantity
        } else if (movement.type === 'OUT') {
          openingStock -= movement.quantity
        } else if (movement.type === 'ADJUSTMENT') {
          // ADJUSTMENT quantity is signed: positive increases, negative decreases
          openingStock += movement.quantity
        }
      }

      // Get movements only within the selected month
      // Convert movement dates to WIB for accurate comparison
      const movementsInMonth = filteredMovements.filter((movement) => {
        const movementDate = toWIB(movement.date)
        return movementDate >= startDate && movementDate <= endDate
      })

      let runningStock = openingStock

      // Calculate stock for each day of the month (going forward from opening stock)
      const maxDay = isFutureMonth
        ? 0
        : isCurrentMonth
          ? currentDay
          : daysInMonth

      for (let day = 1; day <= maxDay; day++) {
        const dayKey = day.toString()

        // Get movements for this specific day
        // Extract date components (year, month, day) in WIB timezone for accurate day comparison
        // This ensures movements are grouped by their calendar date in WIB, not by exact timestamp
        const dayMovements = movementsInMonth.filter((movement) => {
          // Get date components in WIB timezone
          const wibDateParts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Jakarta',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
          }).formatToParts(movement.date)

          const dayPart = wibDateParts.find((p) => p.type === 'day')
          const monthPart = wibDateParts.find((p) => p.type === 'month')
          const yearPart = wibDateParts.find((p) => p.type === 'year')

          if (!dayPart || !monthPart || !yearPart) {
            logger.warn('Movement date parts missing', {
              movementId: movement.id,
              date: movement.date,
              itemId: item.id,
            })
            return false
          }

          const movementDay = parseInt(dayPart.value, 10)
          const movementMonth = parseInt(monthPart.value, 10) - 1 // Month is 0-indexed
          const movementYear = parseInt(yearPart.value, 10)

          return (
            movementDay === day &&
            movementMonth === validatedQuery.month - 1 &&
            movementYear === validatedQuery.year
          )
        })

        // Calculate total IN quantity for the day
        // Include IN movements and positive ADJUSTMENT movements
        const inMovements = dayMovements.filter(
          (m) => m.type === 'IN' || (m.type === 'ADJUSTMENT' && m.quantity > 0)
        )
        const inQty = inMovements.reduce((sum, m) => sum + m.quantity, 0)
        const hasAdjustmentIn = inMovements.some((m) => m.type === 'ADJUSTMENT')

        // Calculate total OUT quantity for the day
        // Include OUT movements and negative ADJUSTMENT movements (as positive values)
        const outMovements = dayMovements.filter(
          (m) => m.type === 'OUT' || (m.type === 'ADJUSTMENT' && m.quantity < 0)
        )
        const outQty = outMovements.reduce(
          (sum, m) =>
            sum + (m.type === 'ADJUSTMENT' ? Math.abs(m.quantity) : m.quantity),
          0
        )
        const hasAdjustmentOut = outMovements.some(
          (m) => m.type === 'ADJUSTMENT'
        )

        // Track adjustments based on dataType
        // Only track if the adjustment affects the current dataType
        switch (validatedQuery.dataType) {
          case 'stok-awal':
            // Stock at start of day - adjustments don't directly affect this
            // But we track if there were adjustments that day for context
            if (hasAdjustmentIn || hasAdjustmentOut) {
              adjustments[item.id][dayKey] = true
            }
            itemData[dayKey] = runningStock
            break
          case 'stok-masuk':
            // Only track positive adjustments (they affect stok-masuk)
            if (hasAdjustmentIn) {
              adjustments[item.id][dayKey] = true
            }
            itemData[dayKey] = inQty
            break
          case 'stok-keluar':
            // Only track negative adjustments (they affect stok-keluar)
            if (hasAdjustmentOut) {
              adjustments[item.id][dayKey] = true
            }
            itemData[dayKey] = outQty
            break
          case 'stok-sisa':
            // Track any adjustments (they affect stok-sisa)
            if (hasAdjustmentIn || hasAdjustmentOut) {
              adjustments[item.id][dayKey] = true
            }
            // Stock at end of day = opening stock + movements
            itemData[dayKey] = runningStock + inQty - outQty
            break
        }

        // Update running stock for next day
        runningStock = runningStock + inQty - outQty
      }

      return {
        itemData,
        hasMovements: movementsInMonth.length > 0,
        openingStock,
      }
    })

    // Filter out items that have:
    // 1. No movements in the month
    // 2. Zero opening stock
    // 3. All values are zero or empty
    const filteredReportData = reportData
      .filter((item) => {
        // If item has movements in this month, include it
        if (item.hasMovements) return true

        // If item has opening stock, include it (even without movements this month)
        if (item.openingStock > 0) return true

        // Otherwise exclude it
        return false
      })
      .map((item) => item.itemData)

    // Filter adjustments to only include items that are in the final report
    const filteredAdjustments: Record<string, Record<string, boolean>> = {}
    filteredReportData.forEach((item) => {
      if (adjustments[item.id]) {
        filteredAdjustments[item.id] = adjustments[item.id]
      }
    })

    return NextResponse.json({
      data: filteredReportData,
      meta: {
        year: validatedQuery.year,
        month: validatedQuery.month,
        type: validatedQuery.type,
        dataType: validatedQuery.dataType,
        daysInMonth,
        currentDay,
      },
      adjustments:
        Object.keys(filteredAdjustments).length > 0
          ? filteredAdjustments
          : undefined,
    })
  } catch (error) {
    logger.error('Error generating stock report:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to generate stock report' },
      { status: 500 }
    )
  }
}
