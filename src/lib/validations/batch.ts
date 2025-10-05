import { z } from "zod"

/**
 * Validation schema for creating/editing batches
 * Used in both frontend forms and backend API validation
 */
export const batchSchema = z.object({
  code: z.string().min(1, "Batch code is required"),
  date: z.date({
    required_error: "Please select a date",
  }),
  description: z.string().optional(),
  finishedGoodId: z.string().min(1, "Please select a finished good"),
  materials: z.array(z.object({
    rawMaterialId: z.string().min(1, "Please select a raw material"),
    quantity: z.coerce.number().positive("Quantity must be positive"),
  })).min(1, "At least one raw material is required"),
})

export type BatchInput = z.infer<typeof batchSchema>
