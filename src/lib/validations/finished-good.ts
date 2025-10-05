import { z } from "zod"

/**
 * Validation schema for creating/editing finished goods
 * Used in both frontend forms and backend API validation
 */
export const finishedGoodSchema = z.object({
  name: z.string().min(1, "Name is required"),
})

export type FinishedGoodInput = z.infer<typeof finishedGoodSchema>
