import { z } from 'zod'

/**
 * Environment variable validation
 * Validates that all required environment variables are set
 * Fails fast at startup if configuration is incorrect
 */

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  DIRECT_URL: z.string().url('DIRECT_URL must be a valid URL').optional(),

  // NextAuth
  NEXTAUTH_SECRET: z
    .string()
    .min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),
  // NEXTAUTH_URL is optional when trustHost is enabled (auto-detected from request)
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL').optional(),

  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
})

/**
 * Validated environment variables
 * Use this instead of process.env for type safety
 */
export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || process.env.AUTH_URL,
  NODE_ENV: process.env.NODE_ENV || 'development',
})

/**
 * Helper to check if we're in production
 */
export const isProduction = env.NODE_ENV === 'production'

/**
 * Helper to check if we're in development
 */
export const isDevelopment = env.NODE_ENV === 'development'
