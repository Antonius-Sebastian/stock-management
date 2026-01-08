import { z } from 'zod'
import { parseToWIB } from '@/lib/timezone'

/**
 * Validation schema for creating stock movements (frontend forms)
 * Uses Date object for date pickers, supports IN and OUT only
 */
export const stockMovementSchema = z.object({
  type: z.enum(['IN', 'OUT']),
  quantity: z.coerce.number().positive('Quantity must be positive'),
  date: z.date({
    required_error: 'Please select a date',
  }),
  description: z.string().optional(),
  rawMaterialId: z.string().optional(),
  finishedGoodId: z.string().optional(),
})

/**
 * Validation schema for stock movement API routes
 * Uses string date with WIB transform and supports ADJUSTMENT type
 */
export const stockMovementSchemaAPI = z
  .object({
    type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
    quantity: z.number(),
    date: z.string().transform((str) => parseToWIB(str)),
    description: z.string().optional(),
    rawMaterialId: z.string().optional(),
    finishedGoodId: z.string().optional(),
  })
  .refine((data) => data.quantity !== 0, {
    message: 'Quantity cannot be zero',
    path: ['quantity'],
  })
  .refine(
    (data) => {
      // IN and OUT must be positive, ADJUSTMENT can be positive or negative
      if (data.type === 'ADJUSTMENT') return true
      return data.quantity > 0
    },
    {
      message: 'Quantity must be positive for IN and OUT movements',
      path: ['quantity'],
    }
  )
  .refine((data) => data.rawMaterialId || data.finishedGoodId, {
    message: 'Either rawMaterialId or finishedGoodId must be provided',
  })

/**
 * Query schema for getting stock movements by date
 */
export const stockMovementQuerySchema = z.object({
  itemId: z.string().min(1),
  date: z.string(),
  itemType: z.enum(['raw-material', 'finished-good']),
})

/**
 * Schema for deleting stock movements by date
 */
export const stockMovementByDateDeleteSchema = z.object({
  itemId: z.string().min(1),
  date: z.string(),
  itemType: z.enum(['raw-material', 'finished-good']),
  movementType: z.enum(['IN', 'OUT']),
})

/**
 * Schema for updating stock movements by date
 */
export const stockMovementByDateUpdateSchema = z.object({
  itemId: z.string().min(1),
  date: z.string(),
  itemType: z.enum(['raw-material', 'finished-good']),
  movementType: z.enum(['IN', 'OUT']),
  quantity: z.number().min(0),
})

export type StockMovementInput = z.infer<typeof stockMovementSchema>
export type StockMovementInputAPI = z.infer<typeof stockMovementSchemaAPI>

export const drumStockInSchema = z.object({
  rawMaterialId: z.string().min(1, 'Please select a raw material'),
  date: z.date({
    required_error: 'Please select a date',
  }),
  description: z.string().optional(),
  drums: z
    .array(
      z.object({
        label: z.string().min(1, 'Drum label is required'),
        quantity: z.coerce.number().positive('Quantity must be positive'),
      })
    )
    .min(1, 'At least one drum is required'),
})

export type DrumStockInForm = z.infer<typeof drumStockInSchema>
