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
 * Supports multiple drums per material entry
 */
export const batchSchemaAPI = z.object({
  code: z.string().min(1, 'Batch code is required'),
  date: z.string().transform((str) => parseToWIB(str)),
  description: z.string().optional(),
  materials: z
    .array(
      z.object({
        rawMaterialId: z.string().min(1, 'Raw material is required'),
        drums: z
          .array(
            z.object({
              drumId: z.string().min(1, 'Drum is required'),
              quantity: z.number().positive('Quantity must be positive'),
            })
          )
          .min(1, 'At least one drum is required per material'),
      })
    )
    .min(1, 'At least one raw material is required')
    .refine((materials) => {
      const materialIds = materials.map((m) => m.rawMaterialId)
      return materialIds.length === new Set(materialIds).size
    }, 'Each material can only be used once per batch')
    .refine((materials) => {
      const allDrumIds: string[] = []
      for (const material of materials) {
        for (const drum of material.drums) {
          if (drum.drumId) {
            allDrumIds.push(drum.drumId)
          }
        }
      }
      return allDrumIds.length === new Set(allDrumIds).size
    }, 'Each drum can only be used once per batch'),
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
