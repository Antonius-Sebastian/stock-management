/**
 * Prisma Database Client
 *
 * Singleton instance of Prisma Client to prevent exhausting database connections.
 * In development, the client is cached globally to survive hot reloads.
 *
 * @see https://www.prisma.io/docs/guides/performance-and-optimization/connection-management
 */

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Shared Prisma Client instance
 *
 * @remarks
 * - In production: Creates a new instance on each deploy
 * - In development: Reuses instance across hot reloads to prevent connection pool exhaustion
 */
export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
