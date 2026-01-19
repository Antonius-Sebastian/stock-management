import { z } from 'zod'
import { parseToWIB } from '@/lib/timezone'

/**
 * Validation schema for creating stock movements (frontend forms)
 * Uses Date object for date pickers, supports IN and OUT only
 */
export const stockMovementSchema = z.object({
  type: z.enum(['IN', 'OUT']),
  quantity: z.coerce
    .number()
    .positive('Quantity must be positive')
    .max(1000000, 'Quantity cannot exceed 1,000,000'),
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
 * For ADJUSTMENT type, accepts either quantity (adjustment amount) or newStock (new stock amount)
 */
export const stockMovementSchemaAPI = z
  .object({
    type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
    quantity: z
      .number()
      .max(1000000, 'Quantity cannot exceed 1,000,000')
      .optional(), // Optional for ADJUSTMENT when newStock is provided
    newStock: z
      .number()
      .max(1000000, 'New stock cannot exceed 1,000,000')
      .optional(), // New stock amount for ADJUSTMENT type
    date: z.string().transform((str) => parseToWIB(str)),
    description: z.string().optional(),
    rawMaterialId: z.string().optional(),
    finishedGoodId: z.string().optional(),
    drumId: z.string().optional(),
    locationId: z.string().optional(),
  })
  .refine(
    (data) => {
      // For ADJUSTMENT, either quantity or newStock must be provided
      if (data.type === 'ADJUSTMENT') {
        return data.quantity !== undefined || data.newStock !== undefined
      }
      // For IN and OUT, quantity is required
      return data.quantity !== undefined
    },
    {
      message: 'Quantity or newStock must be provided',
      path: ['quantity'],
    }
  )
  .superRefine((data, ctx) => {
    if (data.type === 'ADJUSTMENT') {
      // For ADJUSTMENT, if newStock is provided, it must be >= 0
      if (data.newStock !== undefined && data.newStock < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'New stock must be non-negative',
          path: ['newStock'],
        })
      }
    } else {
      // For IN and OUT, quantity must be positive
      if (data.quantity === undefined || data.quantity <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Quantity must be positive for IN and OUT movements',
          path: ['quantity'],
        })
      }
    }
  })
  .refine((data) => data.rawMaterialId || data.finishedGoodId, {
    message: 'Either rawMaterialId or finishedGoodId must be provided',
  })
  .refine(
    (data) => {
      // For raw materials, drumId is required
      if (data.rawMaterialId) {
        return data.drumId && data.drumId.trim() !== ''
      }
      return true
    },
    {
      message: 'Drum is required for raw material stock operations',
      path: ['drumId'],
    }
  )

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

/**
 * Schema for updating individual stock movements
 */
export const updateStockMovementSchema = z
  .object({
    quantity: z
      .number()
      .positive('Quantity must be positive')
      .max(1000000, 'Quantity cannot exceed 1,000,000')
      .optional(),
    date: z
      .string()
      .transform((str) => parseToWIB(str))
      .optional(),
    description: z.string().nullable().optional(),
    locationId: z.string().optional().nullable(),
  })
  .refine(
    (data) =>
      data.quantity !== undefined ||
      data.date !== undefined ||
      data.description !== undefined ||
      data.locationId !== undefined,
    {
      message: 'At least one field must be provided for update',
    }
  )

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
        quantity: z.coerce
          .number()
          .positive('Quantity must be positive')
          .max(1000000, 'Quantity cannot exceed 1,000,000'),
      })
    )
    .min(1, 'At least one drum is required'),
})

export type DrumStockInForm = z.infer<typeof drumStockInSchema>
