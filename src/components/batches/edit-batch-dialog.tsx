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
import type { RawMaterial as BaseRawMaterial } from '@/lib/types'
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
  batchUsages: (BatchUsage & {
    rawMaterial: RawMaterial
    drumId?: string | null
  })[]
}

const createFormSchema = (rawMaterials: RawMaterial[]) =>
  z.object({
    code: z.string().min(1, 'Kode batch wajib diisi'),
    date: z.date({
      required_error: 'Silakan pilih tanggal',
    }),
    description: z.string().optional(),
    materials: z
      .array(
        z
          .object({
            rawMaterialId: z.string().min(1, 'Silakan pilih bahan baku'),
            drumId: z.string().optional(),
            quantity: z.coerce
              .number({
                required_error: 'Jumlah wajib diisi',
                invalid_type_error: 'Jumlah harus berupa angka',
              })
              .refine(
                (val) => !isNaN(val) && val > 0,
                'Jumlah harus lebih besar dari nol'
              ),
          })
          .refine(
            (material) => {
              // Material wajib punya drum - drumId is always required if material has drums
              if (!material.rawMaterialId) return true
              const rawMaterial = rawMaterials.find(
                (rm) => rm.id === material.rawMaterialId
              )
              if (rawMaterial?.drums && rawMaterial.drums.length > 0) {
                return !!material.drumId
              }
              return true
            },
            {
              message: 'Drum wajib dipilih untuk bahan baku ini',
              path: ['drumId'],
            }
          )
      )
      .min(1, 'Minimal satu bahan baku wajib dipilih')
      .refine(
        (materials) => {
          // Prevent duplicate material+drum combinations
          // Allow same material with different drums
          const combos = materials.map(
            (m) => `${m.rawMaterialId}:${m.drumId || ''}`
          )
          return combos.length === new Set(combos).size
        },
        {
          message:
            'Tidak dapat memilih kombinasi bahan baku & drum yang sama lebih dari sekali',
          path: [],
        }
      )
      .refine(
        (materials) => {
          return materials.every((material) => {
            if (!material.rawMaterialId) return true
            const rawMaterial = rawMaterials.find(
              (rm) => rm.id === material.rawMaterialId
            )
            if (!rawMaterial) return true

            if (material.drumId) {
              const drum = rawMaterial.drums?.find(
                (d) => d.id === material.drumId
              )
              return drum ? material.quantity <= drum.currentQuantity : true
            }

            return material.quantity <= rawMaterial.currentStock
          })
        },
        {
          message:
            'Satu atau lebih jumlah melebihi stok yang tersedia (periksa Stok Drum atau Total stok)',
          path: [],
        }
      ),
  })

type FormData = z.infer<ReturnType<typeof createFormSchema>>

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
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([])

  const formSchema = createFormSchema(rawMaterials)
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: '',
      date: new Date(),
      description: '',
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
      const drum = material.drums.find((d) => d.id === drumId)
      if (!drum) return 0
      // Find usage of this specific drum in current batch to add back
      const currentUsage = batch?.batchUsages.find(
        (u) => u.rawMaterialId === materialId && u.drumId === drumId
      )
      return drum.currentQuantity + (currentUsage?.quantity || 0)
    }

    // Default to Total Stock logic
    // Default to Total Stock logic - Logic simplified below
    // Simply return currentStock + all usage of this material in this batch
    const allBatchUsage =
      batch?.batchUsages
        .filter((u) => u.rawMaterialId === materialId)
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
      toast.error('Gagal memuat bahan baku')
    }
  }

  useEffect(() => {
    if (open) {
      fetchRawMaterials()
    } else {
      // Reset form when dialog closes (only if batch is not provided, as batch might be null when closing)
      if (!batch) {
        form.reset({
          code: '',
          date: new Date(),
          description: '',
          materials: [],
        })
      }
    }
  }, [open, batch, form])

  useEffect(() => {
    if (batch && open) {
      form.reset({
        code: batch.code,
        date: new Date(batch.date),
        description: batch.description || '',
        materials: batch.batchUsages.map((usage) => ({
          rawMaterialId: usage.rawMaterialId,
          quantity: usage.quantity,
          drumId: usage.drumId || undefined,
        })),
      })
    }
  }, [batch, open, form])

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
          materials: data.materials,
        }),
      })

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Gagal memperbarui batch')
      }

      toast.success('Batch berhasil diperbarui dengan perubahan bahan baku')
      onOpenChange(false)
      onSuccess()
    },
    successMessage: undefined, // Custom message handled in onSubmit
    errorMessage: 'Gagal memperbarui batch',
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Ubah Batch</DialogTitle>
          <DialogDescription>
            Perbarui informasi batch dan penggunaan bahan baku. (Hanya ADMIN)
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
                    <FormLabel>Kode Batch</FormLabel>
                    <FormControl>
                      <Input placeholder="Masukkan kode batch" {...field} />
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
                    <FormLabel>Tanggal</FormLabel>
                    <FormControl>
                      <DatePickerField
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Pilih tanggal"
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
                  <FormLabel>Deskripsi (Opsional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Masukkan deskripsi" {...field} />
                  </FormControl>
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
                  <div
                    key={field.id}
                    className="mb-4 flex flex-col gap-3 border-b pb-4"
                  >
                    <div className="flex gap-3">
                      <FormField
                        control={form.control}
                        name={`materials.${index}.rawMaterialId`}
                        render={({ field }) => (
                          <FormItem className="flex flex-1 flex-col">
                            <FormLabel>Bahan Baku</FormLabel>
                            <Select
                              onValueChange={(val) => {
                                field.onChange(val)
                                // Reset drum and quantity when material changes
                                form.setValue(
                                  `materials.${index}.drumId`,
                                  undefined
                                )
                                form.setValue(`materials.${index}.quantity`, 0)
                              }}
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
                                      const isInBatch =
                                        materialsInBatch.includes(material.id)
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
                                                (Tersedia:{' '}
                                                {availableStock.toLocaleString()}
                                                )
                                              </span>
                                            ) : (
                                              <span className="text-destructive shrink-0 whitespace-nowrap">
                                                (Stok Habis)
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="hover:bg-destructive/10 hover:text-destructive mt-8 shrink-0"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                        aria-label="Remove material"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>

                      {/* Drum Selector - Show first if material has drums */}
                      <FormField
                        control={form.control}
                        name={`materials.${index}.drumId`}
                        render={({ field }) => {
                          const selectedMaterialId = form.watch(
                            `materials.${index}.rawMaterialId`
                          )
                          const selectedMaterial = rawMaterials.find(
                            (m) => m.id === selectedMaterialId
                          )
                          const hasDrums =
                            selectedMaterial?.drums &&
                            selectedMaterial.drums.length > 0

                          if (!selectedMaterialId || !hasDrums) return <></>

                          // Check if this drum is already used in another material entry
                          const allMaterials = form.watch('materials')
                          const isDrumAlreadyUsed = (drumId: string) => {
                            return allMaterials.some(
                              (m, idx) =>
                                idx !== index &&
                                m.rawMaterialId === selectedMaterialId &&
                                m.drumId === drumId
                            )
                          }

                          return (
                            <FormItem className="flex-1">
                              <FormLabel>Drum</FormLabel>
                              <FormControl>
                                <Select
                                  onValueChange={(value) => {
                                    field.onChange(value)
                                    // Reset quantity when drum changes
                                    form.setValue(`materials.${index}.quantity`, 0)
                                  }}
                                  value={field.value}
                                >
                                  <SelectTrigger className="h-9 w-full">
                                    <SelectValue placeholder="Pilih Drum (Wajib)" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {selectedMaterial?.drums?.map((drum) => {
                                      const isUsed = isDrumAlreadyUsed(drum.id)
                                      const availableStock = getAvailableStock(
                                        selectedMaterialId,
                                        drum.id
                                      )
                                      const isDisabled =
                                        availableStock <= 0 || isUsed
                                      return (
                                        <SelectItem
                                          key={drum.id}
                                          value={drum.id}
                                          disabled={isDisabled}
                                        >
                                          {drum.label} (Sisa:{' '}
                                          {availableStock.toLocaleString()}){' '}
                                          {availableStock <= 0
                                            ? '(Habis)'
                                            : isUsed
                                              ? '(Sudah digunakan)'
                                              : ''}
                                        </SelectItem>
                                      )
                                    })}
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <div className="text-muted-foreground text-xs">
                                Pilih drum terlebih dahulu sebelum memasukkan
                                jumlah. Bahan baku yang sama dapat menggunakan
                                drum yang berbeda.
                              </div>
                              <FormMessage />
                            </FormItem>
                          )
                        }}
                      />

                    {/* Quantity Input - Disabled until drum selected */}
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

                        const hasDrums =
                          selectedMaterial?.drums &&
                          selectedMaterial.drums.length > 0
                        const isQuantityDisabled =
                          hasDrums && !selectedDrumId

                        let availableStock = 0
                        if (selectedDrumId && selectedMaterial) {
                          availableStock = getAvailableStock(
                            selectedMaterialId,
                            selectedDrumId
                          )
                        } else if (selectedMaterial) {
                          availableStock = getAvailableStock(selectedMaterialId)
                        }

                        return (
                          <FormItem className="w-32">
                            <FormLabel>Jumlah</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0"
                                disabled={isQuantityDisabled}
                                {...field}
                              />
                            </FormControl>
                            {isQuantityDisabled && (
                              <p className="text-muted-foreground text-xs">
                                Pilih drum terlebih dahulu
                              </p>
                            )}
                            {selectedMaterial &&
                              !isQuantityDisabled &&
                              availableStock > 0 && (
                                <p className="text-muted-foreground text-xs">
                                  Tersedia: {availableStock.toLocaleString()}
                                </p>
                              )}
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
                  size="sm"
                  className="w-full"
                  onClick={() => append({ rawMaterialId: '', quantity: 0 })}
                >
                  <Plus className="mr-2 h-5 w-5" />
                  Tambah Bahan Baku
                </Button>
              </CardContent>
            </Card>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Memperbarui...' : 'Perbarui'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
