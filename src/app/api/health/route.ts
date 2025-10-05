import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Health Check Endpoint
 * Returns system health status for monitoring
 * Public endpoint (no authentication required)
 */
export async function GET() {
  const startTime = Date.now()

  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`
    const dbResponseTime = Date.now() - startTime

    // Get basic stats
    const [userCount, materialCount, batchCount] = await Promise.all([
      prisma.user.count(),
      prisma.rawMaterial.count(),
      prisma.batch.count(),
    ])

    const responseTime = Date.now() - startTime

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      database: {
        status: 'connected',
        responseTime: `${dbResponseTime}ms`,
      },
      stats: {
        users: userCount,
        rawMaterials: materialCount,
        batches: batchCount,
      },
      performance: {
        totalResponseTime: `${responseTime}ms`,
      },
    })
  } catch (error) {
    console.error('Health check failed:', error)

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        database: {
          status: 'disconnected',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 503 }
    )
  }
}
