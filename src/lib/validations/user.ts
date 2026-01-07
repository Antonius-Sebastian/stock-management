import { z } from 'zod'

/**
 * Validation schema for creating users
 * Used in both frontend forms and backend API validation
 * Strong password validation for API security
 */
export const createUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').optional().nullable(),
  role: z.enum(['ADMIN', 'OFFICE_PURCHASING', 'OFFICE_WAREHOUSE']),
})

/**
 * Validation schema for updating users
 * All fields optional to allow partial updates
 */
export const updateUserSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .optional(),
  email: z.string().email('Invalid email').optional().nullable(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .optional(),
  name: z.string().min(1, 'Name is required').optional(),
  role: z.enum(['ADMIN', 'OFFICE_PURCHASING', 'OFFICE_WAREHOUSE']).optional(),
  isActive: z.boolean().optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
