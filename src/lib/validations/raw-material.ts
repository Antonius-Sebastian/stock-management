import { z } from 'zod'

/**
 * Validation schema for creating/editing raw materials
 * Used in both frontend forms and backend API validation
 */
export const rawMaterialSchema = z.object({
  kode: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  moq: z.coerce.number().min(1, 'MOQ must be at least 1'),
})

export type RawMaterialInput = z.infer<typeof rawMaterialSchema>
