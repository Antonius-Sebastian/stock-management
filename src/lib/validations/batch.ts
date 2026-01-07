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
 * Uses string date with WIB transform
 */
export const batchSchemaAPI = z.object({
  code: z.string().min(1, 'Batch code is required'),
  date: z.string().transform((str) => parseToWIB(str)),
  description: z.string().optional(),
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  materials: z
    .array(
      z.object({
        rawMaterialId: z.string().min(1, 'Raw material is required'),
        quantity: z.number().positive('Quantity must be positive'),
        drumId: z.string().optional(),
      })
    )
    .min(1, 'At least one raw material is required'),
})

/**
 * Validation schema for adding finished goods to a batch
 * Used in the separate endpoint for adding finished goods
 */
export const addFinishedGoodsSchema = z.object({
  finishedGoods: z
    .array(
      z.object({
        finishedGoodId: z.string().min(1, 'Finished good is required'),
        quantity: z.number().positive('Quantity must be positive'),
      })
    )
    .min(1, 'At least one finished good is required')
    .refine((finishedGoods) => {
      const finishedGoodIds = finishedGoods.map((fg) => fg.finishedGoodId)
      return finishedGoodIds.length === new Set(finishedGoodIds).size
    }, 'Cannot select the same finished good multiple times'),
})

export type BatchInput = z.infer<typeof batchSchema>
export type BatchInputAPI = z.infer<typeof batchSchemaAPI>
export type AddFinishedGoodsInput = z.infer<typeof addFinishedGoodsSchema>
