'use client'

import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ItemSelector, DatePickerField } from '@/components/forms'
import { useFormSubmission } from '@/lib/hooks'
import type { RawMaterial } from '@/lib/types'
import { getWIBDate } from '@/lib/timezone'
import { logger } from '@/lib/logger'

const createFormSchema = (rawMaterials: RawMaterial[]) =>
  z.object({
    code: z.string().min(1, 'Batch code is required'),
    date: z.date({
      required_error: 'Please select a date',
    }),
    description: z.string().optional(),
    materials: z
      .array(
        z.object({
          rawMaterialId: z.string().min(1, 'Please select a raw material'),
          quantity: z.coerce
            .number({
              required_error: 'Quantity is required',
              invalid_type_error: 'Quantity must be a number',
            })
            .refine(
              (val) => !isNaN(val) && val > 0,
              'Quantity must be greater than zero'
            ),
        })
      )
      .min(1, 'At least one raw material is required')
      .refine((materials) => {
        const materialIds = materials
          .map((m) => m.rawMaterialId)
          .filter((id) => id !== '')
        return materialIds.length === new Set(materialIds).size
      }, 'Cannot select the same raw material multiple times')
      .refine(
        (materials) => {
          return materials.every((material) => {
            if (!material.rawMaterialId) return true
            const rawMaterial = rawMaterials.find(
              (rm) => rm.id === material.rawMaterialId
            )
            return rawMaterial
              ? material.quantity <= rawMaterial.currentStock
              : true
          })
        },
        {
          message: 'One or more quantities exceed available stock',
          path: [],
        }
      ),
  })

interface AddBatchDialogProps {
  onSuccess: () => void
}

export function AddBatchDialog({ onSuccess }: AddBatchDialogProps) {
  const [open, setOpen] = useState(false)
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([])

  const formSchema = createFormSchema(rawMaterials)
  type FormData = z.infer<typeof formSchema>
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: '',
      date: getWIBDate(),
      description: '',
      materials: [{ rawMaterialId: '', quantity: '' as unknown as number }],
    },
    mode: 'onSubmit',
  })

  // Update form validation when rawMaterials change
  useEffect(() => {
    if (rawMaterials.length > 0) {
      form.clearErrors()
    }
  }, [rawMaterials, form])

  const {
    fields: materialFields,
    append: addMaterial,
    remove: removeMaterial,
  } = useFieldArray({
    control: form.control,
    name: 'materials',
  })

  const fetchData = async () => {
    try {
      const rawMaterialsRes = await fetch('/api/raw-materials')

      if (!rawMaterialsRes.ok) {
        throw new Error('Failed to fetch required data')
      }

      const rawMaterialsData = await rawMaterialsRes.json()
      // Handle both array response and paginated response
      const rawMats = Array.isArray(rawMaterialsData)
        ? rawMaterialsData
        : rawMaterialsData.data || []
      setRawMaterials(rawMats)
    } catch (error) {
      logger.error('Error fetching data:', error)
      toast.error('Failed to load required data. Please try again.')
    }
  }

  useEffect(() => {
    if (open) {
      fetchData()
    }
  }, [open])

  const { handleSubmit: handleFormSubmit, isLoading } = useFormSubmission({
    onSubmit: async (data: FormData) => {
      const response = await fetch('/api/batches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: data.code,
          date: data.date.toISOString(),
          description: data.description,
          finishedGoods: [],
          materials: data.materials,
        }),
      })

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to create batch')
      }

      toast.success('Batch created successfully')
      form.reset()
      setOpen(false)
      onSuccess()
    },
    successMessage: undefined, // Custom message handled in onSubmit
    errorMessage: 'Failed to create batch',
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Catat Pemakaian Baru
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] max-w-[95vw] flex-col sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Catat Pemakaian Baru</DialogTitle>
          <DialogDescription>
            Record a new production batch with raw materials. Finished goods can
            be added after the batch is created.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleFormSubmit)}
            className="flex-1 space-y-6 overflow-y-auto pr-2"
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

            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">
                  Bahan Baku yang Digunakan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                {materialFields.map((field, index) => (
                  <div
                    key={field.id}
                    className="hover:bg-muted/50 flex items-end gap-3 rounded-lg border p-3 transition-colors"
                  >
                    <FormField
                      control={form.control}
                      name={`materials.${index}.rawMaterialId`}
                      render={({ field }) => (
                        <FormItem className="flex flex-1 flex-col">
                          <FormLabel>Bahan Baku</FormLabel>
                          <FormControl>
                            <ItemSelector
                              items={rawMaterials}
                              itemType="raw-material"
                              value={field.value}
                              onValueChange={field.onChange}
                              placeholder="Pilih bahan baku"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`materials.${index}.quantity`}
                      render={({ field }) => {
                        const selectedMaterialId = form.watch(
                          `materials.${index}.rawMaterialId`
                        )
                        const selectedMaterial = rawMaterials.find(
                          (m) => m.id === selectedMaterialId
                        )
                        const availableStock =
                          selectedMaterial?.currentStock || 0

                        return (
                          <FormItem className="w-40">
                            <FormLabel>Quantity</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0"
                                {...field}
                              />
                            </FormControl>
                            {selectedMaterial && (
                              <p className="text-muted-foreground text-xs">
                                Available: {availableStock.toLocaleString()}
                              </p>
                            )}
                            <FormMessage />
                          </FormItem>
                        )
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="hover:bg-destructive/10 hover:text-destructive shrink-0"
                      onClick={() => removeMaterial(index)}
                      disabled={materialFields.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    addMaterial({
                      rawMaterialId: '',
                      quantity: '' as unknown as number,
                    })
                  }
                  className="hover:bg-muted/50 w-full border-dashed transition-colors hover:border-solid"
                  disabled={isLoading}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah Bahan Baku
                </Button>
              </CardContent>
            </Card>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isLoading}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Membuat...' : 'Buat Batch'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
