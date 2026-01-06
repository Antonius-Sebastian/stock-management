'use client'

import { useEffect, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePickerField } from '@/components/forms'
import { useFormSubmission } from '@/lib/hooks'
import { logger } from '@/lib/logger'
import type { RawMaterial as BaseRawMaterial, FinishedGood } from '@/lib/types'
import { Batch, BatchUsage } from '@prisma/client'

// Extended RawMaterial type to include drums
interface Drum {
  id: string
  label: string
  currentQuantity: number
  isActive: boolean
}

interface RawMaterial extends BaseRawMaterial {
  drums?: Drum[]
}

type BatchWithUsage = Batch & {
  batchFinishedGoods?: Array<{
    finishedGood: FinishedGood
    finishedGoodId: string
    quantity: number
  }>
  batchUsages: (BatchUsage & {
    rawMaterial: RawMaterial
    drumId?: string | null
  })[]
}

const formSchema = z.object({
  code: z.string().min(1, 'Batch code is required'),
  date: z.date({
    required_error: 'Please select a date',
  }),
  description: z.string().optional(),
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  finishedGoodId: z.string().min(1, 'Please select a finished good'),
  materials: z
    .array(
      z.object({
        rawMaterialId: z.string().min(1, 'Please select a raw material'),
        drumId: z.string().optional(),
        quantity: z.coerce.number().positive('Quantity must be greater than 0'),
      })
    )
    .min(1, 'At least one raw material is required'),
})

type FormData = z.infer<typeof formSchema>

interface EditBatchDialogProps {
  batch: BatchWithUsage | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditBatchDialog({
  batch,
  open,
  onOpenChange,
  onSuccess,
}: EditBatchDialogProps) {
  const [finishedGoods, setFinishedGoods] = useState<FinishedGood[]>([])
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([])

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: '',
      date: new Date(),
      description: '',
      status: 'IN_PROGRESS',
      finishedGoodId: '',
      materials: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'materials',
  })

  /* 
   * Calculate available stock. 
   * NOTE: For complex drum logic (multi-drum usage in one batch), calculation is trickier.
   * For MVP, we show Total Stock. If drum is selected, we show drum stock in the selector.
   */
  const getAvailableStock = (materialId: string, drumId?: string): number => {
    const material = rawMaterials.find((m) => m.id === materialId)
    if (!material) return 0

    if (drumId && material.drums) {
        const drum = material.drums.find(d => d.id === drumId)
        if (!drum) return 0
        // Find usage of this specific drum in current batch to add back
        const currentUsage = batch?.batchUsages.find(u => u.rawMaterialId === materialId && u.drumId === drumId)
        return drum.currentQuantity + (currentUsage?.quantity || 0)
    }

    // Default to Total Stock logic
    // Default to Total Stock logic - Logic simplified below
    // Simply return currentStock + all usage of this material in this batch
    const allBatchUsage = batch?.batchUsages
        .filter(u => u.rawMaterialId === materialId)
        .reduce((sum, u) => sum + u.quantity, 0) || 0
    
    return material.currentStock + allBatchUsage
  }

  // Get list of material IDs currently used in the batch
  const materialsInBatch = batch?.batchUsages.map((u) => u.rawMaterialId) || []

  // Sort materials: materials in batch first, then by stock availability, then alphabetically
  const sortedRawMaterials = [...rawMaterials].sort((a, b) => {
    const aInBatch = materialsInBatch.includes(a.id)
    const bInBatch = materialsInBatch.includes(b.id)

    // Materials in batch come first
    if (aInBatch && !bInBatch) return -1
    if (!aInBatch && bInBatch) return 1

    // Then sort by available stock
    const aAvailable = getAvailableStock(a.id)
    const bAvailable = getAvailableStock(b.id)
    if (aAvailable > 0 && bAvailable === 0) return -1
    if (aAvailable === 0 && bAvailable > 0) return 1

    // Finally sort alphabetically
    return a.name.localeCompare(b.name)
  })

  const fetchFinishedGoods = async () => {
    try {
      const response = await fetch('/api/finished-goods')
      if (!response.ok) {
        throw new Error('Failed to fetch finished goods')
      }
      const json = await response.json()
      // API returns { success: true, data: [...] }
      const data = json.data || json
      setFinishedGoods(Array.isArray(data) ? data : [])
    } catch (error) {
      logger.error('Error fetching finished goods:', error)
      toast.error('Failed to load finished goods')
    }
  }

  const fetchRawMaterials = async () => {
    try {
      const response = await fetch('/api/raw-materials?include=drums')
      if (!response.ok) {
        throw new Error('Failed to fetch raw materials')
      }
      const json = await response.json()
      const data = json.data || json
      setRawMaterials(Array.isArray(data) ? data : [])
    } catch (error) {
      logger.error('Error fetching raw materials:', error)
      toast.error('Failed to load raw materials')
    }
  }

  useEffect(() => {
    if (open) {
      fetchFinishedGoods()
      fetchRawMaterials()
    }
  }, [open])

  useEffect(() => {
    if (batch) {
      form.reset({
        code: batch.code,
        date: new Date(batch.date),
        description: batch.description || '',
        status:
          (batch.status as 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED') ||
          'IN_PROGRESS',
        finishedGoodId: batch.batchFinishedGoods?.[0]?.finishedGoodId || '',
        materials: batch.batchUsages.map((usage) => ({
          rawMaterialId: usage.rawMaterialId,
          quantity: usage.quantity,
          drumId: usage.drumId || undefined,
        })),
      })
    }
  }, [batch, form])

  const { handleSubmit: handleFormSubmit, isLoading } = useFormSubmission({
    onSubmit: async (data: FormData) => {
      if (!batch) return

      const response = await fetch(`/api/batches/${batch.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: data.code,
          date: data.date.toISOString(),
          description: data.description,
          status: data.status,
          finishedGoods: data.finishedGoodId
            ? [{ finishedGoodId: data.finishedGoodId, quantity: 0 }]
            : [],
          materials: data.materials,
        }),
      })

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to update batch')
      }

      toast.success('Batch updated successfully with material changes')
      onOpenChange(false)
      onSuccess()
    },
    successMessage: undefined, // Custom message handled in onSubmit
    errorMessage: 'Failed to update batch',
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Edit Batch</DialogTitle>
          <DialogDescription>
            Update batch information and raw materials usage. (ADMIN only)
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleFormSubmit)}
            className="space-y-4 overflow-hidden"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Batch Code</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter batch code" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <DatePickerField
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Pick a date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || 'IN_PROGRESS'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="IN_PROGRESS">Dalam Proses</SelectItem>
                      <SelectItem value="COMPLETED">Selesai</SelectItem>
                      <SelectItem value="CANCELLED">Dibatalkan</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="finishedGoodId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Produk Jadi</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ''}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih produk jadi" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {finishedGoods.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Bahan Baku yang Digunakan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex flex-col gap-2 border-b pb-4 mb-4">
                    <div className="flex items-start gap-2">
                    <FormField
                      control={form.control}
                      name={`materials.${index}.rawMaterialId`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Bahan Baku</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full [&>span]:truncate">
                                <SelectValue placeholder="Pilih bahan baku" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {sortedRawMaterials.length === 0 ? (
                                <div className="text-muted-foreground px-2 py-6 text-center text-sm">
                                  Tidak ada bahan baku tersedia
                                </div>
                              ) : (
                                <>
                                  {sortedRawMaterials.map((material) => {
                                    const availableStock = getAvailableStock(
                                      material.id
                                    )
                                    const isInBatch = materialsInBatch.includes(
                                      material.id
                                    )
                                    const isDisabled =
                                      availableStock === 0 && !isInBatch

                                    return (
                                      <SelectItem
                                        key={material.id}
                                        value={material.id}
                                        disabled={isDisabled}
                                      >
                                        <div className="flex max-w-[400px] items-center gap-2">
                                          <span className="truncate">
                                            {material.kode} - {material.name}
                                          </span>
                                          {availableStock > 0 ? (
                                            <span className="shrink-0 font-medium whitespace-nowrap text-green-600">
                                              (Available:{' '}
                                              {availableStock.toLocaleString()})
                                            </span>
                                          ) : (
                                            <span className="text-destructive shrink-0 whitespace-nowrap">
                                              (No Stock)
                                            </span>
                                          )}
                                        </div>
                                      </SelectItem>
                                    )
                                  })}
                                </>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`materials.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem className="w-32">
                          <FormLabel>Quantity</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-8"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                   {/* Drum Selector Row */}
                   <FormField
                      control={form.control}
                      name={`materials.${index}.drumId`}
                      render={({ field }) => {
                         const selectedMaterialId = form.watch(`materials.${index}.rawMaterialId`)
                         const selectedMaterial = rawMaterials.find(m => m.id === selectedMaterialId)
                         const hasDrums = selectedMaterial?.drums && selectedMaterial.drums.length > 0

                         if (!selectedMaterialId || !hasDrums) return <></>

                        return (
                          <div className="ml-2 pl-4 border-l-2 border-muted mb-4">
                              <FormItem className="flex-1">
                                <FormControl>
                                  <Select
                                    onValueChange={field.onChange}
                                    value={field.value || "fifo"}
                                  >
                                    <SelectTrigger className="w-full text-xs h-8">
                                      <SelectValue placeholder="Pilih Drum (Opsional - Auto FIFO)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="fifo">Auto (FIFO)</SelectItem>
                                        {selectedMaterial?.drums?.map(drum => (
                                            <SelectItem key={drum.id} value={drum.id}>
                                                {drum.label} (Sisa: {getAvailableStock(selectedMaterialId, drum.id)} kg)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                                <div className="text-[10px] text-muted-foreground">
                                    Pilih drum spesifik atau biarkan Auto.
                                </div>
                                <FormMessage />
                              </FormItem>
                          </div>
                        )
                      }}
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => append({ rawMaterialId: '', quantity: 0 })}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Material
                </Button>
              </CardContent>
            </Card>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Updating...' : 'Update'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
