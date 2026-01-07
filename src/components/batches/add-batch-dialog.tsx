'use client'

import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Plus, Trash2 } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ItemSelector, DatePickerField } from '@/components/forms'
import { useFormSubmission } from '@/lib/hooks'
import type { RawMaterial as BaseRawMaterial } from '@/lib/types'
import { getWIBDate } from '@/lib/timezone'
import { logger } from '@/lib/logger'

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
          drumId: z.string().optional(),
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
        .refine(
          (material) => {
            // If material has drums, drumId is required
            if (!material.rawMaterialId) return true
            const rawMaterial = rawMaterials.find(rm => rm.id === material.rawMaterialId)
            if (rawMaterial?.drums && rawMaterial.drums.length > 0) {
              return !!material.drumId
            }
            return true
          },
          {
            message: 'Pilih drum untuk bahan baku ini',
            path: ['drumId'],
          }
        )
      )
      .min(1, 'At least one raw material is required')
      .refine((materials) => {
        // Unique combo of rawMaterialId + drumId (or just rawMaterialId if no drum?)
        // Requirement allows multiple drums for same material? "BatchUsage needs drumId... unique constraint [batchId, rawMaterialId, drumId]"
        // So yes, we can have multiple lines for same material but different drums.
        // But the UI might strictly enforce one line per material for simplicity if not requested otherwise.
        // Re-reading requirements: "Allow selection of specific drums for material usage".
        // It implies splitting usage across drums.
        // For now, let's enforce unique rawMaterialId as per original logic, but if users need multi-drum, they'd need multiple rows.
        // Current logic enforces unique rawMaterialId. I will KEEP this for V1 to simplify UI, assuming 1 batch usually pulls from 1 drum or FIFO.
        // If they need 2 drums, they might need to create 2 batches or I need to relax this constraint.
        // Let's relax unique check to allow same material multiple times IF drumId is different.
        
        const combos = materials.map(m => `${m.rawMaterialId}:${m.drumId || ''}`)
        return combos.length === new Set(combos).size
      }, 'Cannot select the same raw material & drum combination multiple times')
      .refine(
        (materials) => {
          return materials.every((material) => {
            if (!material.rawMaterialId) return true
            const rawMaterial = rawMaterials.find(
              (rm) => rm.id === material.rawMaterialId
            )
            if (!rawMaterial) return true

            if (material.drumId) {
                const drum = rawMaterial.drums?.find(d => d.id === material.drumId)
                return drum ? material.quantity <= drum.currentQuantity : true
            }

            return material.quantity <= rawMaterial.currentStock
          })
        },
        {
          message: 'One or more quantities exceed available stock (check Drum or Total stock)',
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
      // Fetch with drums included
      const rawMaterialsRes = await fetch('/api/raw-materials?include=drums')

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
            Catat batch produksi baru dengan bahan baku. Pilih drum spesifik untuk setiap bahan.
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
                    className="hover:bg-muted/50 flex flex-col gap-3 rounded-lg border p-3 transition-colors"
                  >
                    <div className="flex gap-3">
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
                                onValueChange={(val) => {
                                    field.onChange(val)
                                    // Reset drum when material changes
                                    form.setValue(`materials.${index}.drumId`, undefined)
                                }}
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
                             const selectedDrumId = form.watch(
                            `materials.${index}.drumId`
                            )
                            const selectedMaterial = rawMaterials.find(
                            (m) => m.id === selectedMaterialId
                            )
                            
                            let availableStock = selectedMaterial?.currentStock || 0
                            if (selectedDrumId && selectedMaterial?.drums) {
                                const drum = selectedMaterial.drums.find(d => d.id === selectedDrumId)
                                if (drum) availableStock = drum.currentQuantity
                            }

                            return (
                            <FormItem className="w-32">
                                <FormLabel>Qty (kg)</FormLabel>
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
                                    Avail: {availableStock.toLocaleString()}
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
                            className="mt-8 hover:bg-destructive/10 hover:text-destructive shrink-0"
                            onClick={() => removeMaterial(index)}
                            disabled={materialFields.length === 1}
                            aria-label="Remove material"
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
                          <FormItem className="flex-1">
                            <FormControl>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <SelectTrigger className="w-full text-xs h-8">
                                  <SelectValue placeholder="Pilih Drum" />
                                </SelectTrigger>
                                <SelectContent>
                                    {selectedMaterial?.drums?.map(drum => (
                                        <SelectItem key={drum.id} value={drum.id} disabled={drum.currentQuantity <= 0}>
                                            {drum.label} (Sisa: {drum.currentQuantity} kg) {drum.currentQuantity <= 0 ? '(Habis)' : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                             <div className="text-[10px] text-muted-foreground">
                                Pilih drum yang akan digunakan untuk bahan baku ini.
                            </div>
                            <FormMessage />
                          </FormItem>
                        )
                      }}
                    />

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
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isLoading ? 'Membuat...' : 'Buat Batch'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
