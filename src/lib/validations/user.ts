import { z } from "zod"

/**
 * Validation schema for creating users
 * Used in both frontend forms and backend API validation
 */
export const createUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  role: z.enum(["ADMIN", "FACTORY", "OFFICE"]),
})

/**
 * Validation schema for updating users
 */
export const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.enum(["ADMIN", "FACTORY", "OFFICE"]),
  isActive: z.boolean(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
