import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { auth } from '@/auth'
import { canViewReports, getPermissionErrorMessage } from '@/lib/rbac'
import { logger } from '@/lib/logger'

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

    // Generate date range for the month
    const startDate = new Date(validatedQuery.year, validatedQuery.month - 1, 1)
    const endDate = new Date(validatedQuery.year, validatedQuery.month, 0)
    const daysInMonth = endDate.getDate()

    // Only show data up to current date for current month, show all days for past months
    const today = new Date()
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

    // Calculate stock data for each day
    const reportData = items.map((item) => {
      const itemData: Record<string, string | number> = {
        id: item.id,
        name: item.name,
        code: 'kode' in item ? (item as { kode?: string }).kode || '' : '',
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
      const movementsBeforeMonth = filteredMovements.filter((movement) => {
        const movementDate = new Date(movement.date)
        return movementDate < startDate
      })

      let openingStock = 0
      for (const movement of movementsBeforeMonth) {
        if (movement.type === 'IN') {
          openingStock += movement.quantity
        } else {
          openingStock -= movement.quantity
        }
      }

      // Get movements only within the selected month
      const movementsInMonth = filteredMovements.filter((movement) => {
        const movementDate = new Date(movement.date)
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
        const dayMovements = movementsInMonth.filter((movement) => {
          const movementDate = new Date(movement.date)
          return (
            movementDate.getDate() === day &&
            movementDate.getMonth() === validatedQuery.month - 1 &&
            movementDate.getFullYear() === validatedQuery.year
          )
        })

        const inQty = dayMovements
          .filter((m) => m.type === 'IN')
          .reduce((sum, m) => sum + m.quantity, 0)

        const outQty = dayMovements
          .filter((m) => m.type === 'OUT')
          .reduce((sum, m) => sum + m.quantity, 0)

        switch (validatedQuery.dataType) {
          case 'stok-awal':
            // Stock at start of day
            itemData[dayKey] = runningStock
            break
          case 'stok-masuk':
            itemData[dayKey] = inQty
            break
          case 'stok-keluar':
            itemData[dayKey] = outQty
            break
          case 'stok-sisa':
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
