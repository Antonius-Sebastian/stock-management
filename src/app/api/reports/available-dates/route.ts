import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { canViewReports, getPermissionErrorMessage } from '@/lib/rbac'
import { logger } from '@/lib/logger'

/**
 * GET /api/reports/available-dates
 *
 * Returns available year/month combinations based on actual stock movement data
 * Only returns dates where stock movements exist
 */
export async function GET() {
  try {
    // Authentication and authorization required
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

    // Get all stock movements to extract unique year/month combinations
    // Note: Prisma distinct doesn't work on DateTime fields, so we fetch all and group in memory
    const movements = await prisma.stockMovement.findMany({
      select: {
        date: true,
      },
      orderBy: {
        date: 'asc',
      },
    })

    // If no movements exist, return current year/month
    if (movements.length === 0) {
      const currentDate = new Date()
      const currentYear = currentDate.getFullYear()
      const currentMonth = currentDate.getMonth() + 1
      return NextResponse.json({
        dates: [
          {
            year: currentYear,
            months: [currentMonth],
          },
        ],
      })
    }

    // Group by year and collect months
    const yearMonthMap = new Map<number, Set<number>>()

    for (const movement of movements) {
      const movementDate = new Date(movement.date)
      const year = movementDate.getFullYear()
      const month = movementDate.getMonth() + 1

      if (!yearMonthMap.has(year)) {
        yearMonthMap.set(year, new Set())
      }
      yearMonthMap.get(year)!.add(month)
    }

    // Convert to array format and sort months
    const dates = Array.from(yearMonthMap.entries())
      .map(([year, months]) => ({
        year,
        months: Array.from(months).sort((a, b) => a - b),
      }))
      .sort((a, b) => a.year - b.year)

    return NextResponse.json({
      dates,
    })
  } catch (error) {
    logger.error('Error fetching available dates:', error)

    // Fallback to current year/month if error occurs
    const currentDate = new Date()
    const currentYear = currentDate.getFullYear()
    const currentMonth = currentDate.getMonth() + 1
    return NextResponse.json({
      dates: [
        {
          year: currentYear,
          months: [currentMonth],
        },
      ],
    })
  }
}

