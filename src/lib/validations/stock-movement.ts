import { z } from "zod"

/**
 * Validation schema for creating stock movements
 * Used in both frontend forms and backend API validation
 */
export const stockMovementSchema = z.object({
  type: z.enum(["IN", "OUT"]),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  date: z.date({
    required_error: "Please select a date",
  }),
  description: z.string().optional(),
  rawMaterialId: z.string().optional(),
  finishedGoodId: z.string().optional(),
})

export type StockMovementInput = z.infer<typeof stockMovementSchema>
