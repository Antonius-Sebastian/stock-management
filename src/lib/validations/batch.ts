import { z } from 'zod'
import { parseToWIB } from '@/lib/timezone'

/**
 * Validation schema for creating/editing batches (frontend forms)
 * Uses Date object for date pickers
 */
export const batchSchema = z.object({
  code: z.string().min(1, 'Batch code is required'),
  date: z.date({
    required_error: 'Please select a date',
  }),
  description: z.string().optional(),
  finishedGoodId: z.string().min(1, 'Please select a finished good'),
  materials: z
    .array(
      z.object({
        rawMaterialId: z.string().min(1, 'Please select a raw material'),
        quantity: z.coerce.number().positive('Quantity must be positive'),
      })
    )
    .min(1, 'At least one raw material is required'),
})

/**
 * Validation schema for batch API routes
 * Uses string date with WIB transform and supports multiple finished goods
 */
export const batchSchemaAPI = z.object({
  code: z.string().min(1, 'Batch code is required'),
  date: z.string().transform((str) => parseToWIB(str)),
  description: z.string().optional(),
  finishedGoods: z
    .array(
      z.object({
        finishedGoodId: z.string().min(1, 'Finished good is required'),
        quantity: z.number().positive('Quantity must be positive'),
      })
    )
    .min(1, 'At least one finished good is required'),
  materials: z
    .array(
      z.object({
        rawMaterialId: z.string().min(1, 'Raw material is required'),
        quantity: z.number().positive('Quantity must be positive'),
      })
    )
    .min(1, 'At least one raw material is required'),
})

export type BatchInput = z.infer<typeof batchSchema>
export type BatchInputAPI = z.infer<typeof batchSchemaAPI>
