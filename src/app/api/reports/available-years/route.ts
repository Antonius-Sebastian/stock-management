import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { canViewReports, getPermissionErrorMessage } from '@/lib/rbac'
import { logger } from '@/lib/logger'

/**
 * GET /api/reports/available-years
 *
 * Returns available years based on earliest stock movement data
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

    // Get earliest and latest dates from stock movements
    const earliestMovement = await prisma.stockMovement.findFirst({
      orderBy: { date: 'asc' },
      select: { date: true },
    })

    const latestMovement = await prisma.stockMovement.findFirst({
      orderBy: { date: 'desc' },
      select: { date: true },
    })

    // If no movements exist, return current year
    if (!earliestMovement) {
      const currentYear = new Date().getFullYear()
      return NextResponse.json({
        years: [currentYear.toString()],
        earliestYear: currentYear,
        latestYear: currentYear,
      })
    }

    const earliestYear = new Date(earliestMovement.date).getFullYear()
    const latestYear = latestMovement
      ? new Date(latestMovement.date).getFullYear()
      : new Date().getFullYear()

    // Generate array of years from earliest to latest (or current year, whichever is later)
    const currentYear = new Date().getFullYear()
    const endYear = Math.max(latestYear, currentYear)
    const years: string[] = []

    for (let year = earliestYear; year <= endYear; year++) {
      years.push(year.toString())
    }

    return NextResponse.json({
      years,
      earliestYear,
      latestYear: endYear,
    })
  } catch (error) {
    logger.error('Error fetching available years:', error)

    // Fallback to current year if error occurs
    const currentYear = new Date().getFullYear()
    return NextResponse.json({
      years: [currentYear.toString()],
      earliestYear: currentYear,
      latestYear: currentYear,
    })
  }
}
