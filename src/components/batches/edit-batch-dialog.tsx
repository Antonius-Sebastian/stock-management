'use client'

import { useEffect, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Trash2, Plus, Loader2 } from 'lucide-react'
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
        z.object({
          rawMaterialId: z.string().min(1, 'Silakan pilih bahan baku'),
          drums: z
            .array(
              z.object({
                drumId: z.string().min(1, 'Drum wajib dipilih'),
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
            )
            .min(1, 'Minimal satu drum wajib dipilih untuk bahan baku ini'),
        })
      )
      .min(1, 'Minimal satu bahan baku wajib dipilih')
      .refine((materials) => {
        // Prevent duplicate materials
        const materialIds = materials.map((m) => m.rawMaterialId)
        return materialIds.length === new Set(materialIds).size
      }, 'Setiap bahan baku hanya dapat digunakan sekali per batch')
      .refine((materials) => {
        // Prevent duplicate drums across all materials
        const allDrumIds: string[] = []
        for (const material of materials) {
          for (const drum of material.drums) {
            if (drum.drumId) {
              allDrumIds.push(drum.drumId)
            }
          }
        }
        return allDrumIds.length === new Set(allDrumIds).size
      }, 'Setiap drum hanya dapat digunakan sekali per batch')
      .refine((materials) => {
        // Prevent duplicate drums within the same material
        for (const material of materials) {
          const drumIds = material.drums.map((d) => d.drumId)
          if (drumIds.length !== new Set(drumIds).size) {
            return false
          }
        }
        return true
      }, 'Drum yang sama tidak dapat digunakan lebih dari sekali untuk bahan baku yang sama')
      .refine(
        (materials) => {
          // Validate stock availability
          return materials.every((material) => {
            if (!material.rawMaterialId) return true
            const rawMaterial = rawMaterials.find(
              (rm) => rm.id === material.rawMaterialId
            )
            if (!rawMaterial) return true

            return material.drums.every((drumEntry) => {
              if (!drumEntry.drumId) return true
              const drum = rawMaterial.drums?.find(
                (d) => d.id === drumEntry.drumId
              )
              return drum ? drumEntry.quantity <= drum.currentQuantity : true
            })
          })
        },
        {
          message: 'Satu atau lebih jumlah melebihi stok yang tersedia di drum',
          path: [],
        }
      ),
  })

type BatchFormData = z.infer<ReturnType<typeof createFormSchema>>

interface MaterialDrumsFieldArrayProps {
  materialIndex: number
  selectedMaterial: RawMaterial
  usedDrumIds: Set<string>
  usedDrumIdsInThisMaterial: Set<string>
  form: any
  batch?: BatchWithUsage | null
  getAvailableStock: (materialId: string, drumId?: string) => number
}

function MaterialDrumsFieldArray({
  materialIndex,
  selectedMaterial,
  usedDrumIds,
  usedDrumIdsInThisMaterial,
  form,
  batch,
  getAvailableStock,
}: MaterialDrumsFieldArrayProps) {
  const drumPath = `materials.${materialIndex}.drums` as const
  const {
    fields: drumFields,
    append: addDrum,
    remove: removeDrum,
  } = useFieldArray({
    control: form.control,
    name: drumPath as any,
  })

  // Get all selected drum IDs in this material for display purposes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drums = form.watch(drumPath as any) as Array<{
    drumId: string
    quantity: number
  }>
  const selectedDrumIdsInThisMaterial = new Set(
    drums.map((d) => d.drumId).filter((id) => id)
  )

  // Get available drums (not used in other materials, and with stock > 0)
  // For edit mode, also include drums that are already used in this batch
  // Always include currently selected drums so SelectValue can display them
  const availableDrums =
    selectedMaterial.drums?.filter((drum) => {
      const isSelected = selectedDrumIdsInThisMaterial.has(drum.id)
      if (isSelected) return true // Always include selected drum for display
      const availableStock = getAvailableStock(selectedMaterial.id, drum.id)
      return availableStock > 0 && !usedDrumIds.has(drum.id)
    }) || []

  return (
    <div className="space-y-3">
      {drumFields.map((drumField, drumIndex) => {
        const selectedDrumId = drums[drumIndex]?.drumId
        const selectedDrum = selectedMaterial.drums?.find(
          (d) => d.id === selectedDrumId
        )
        const isDrumUsedInThisMaterial =
          selectedDrumId &&
          drums.filter(
            (d, idx) => idx !== drumIndex && d.drumId === selectedDrumId
          ).length > 0

        const drumIdPath = `${drumPath}.${drumIndex}.drumId` as any
        const quantityPath = `${drumPath}.${drumIndex}.quantity` as any

        return (
          <div
            key={drumField.id}
            className="bg-muted/30 flex flex-col gap-3 rounded-lg border p-3"
          >
            <div className="flex gap-3">
              <FormField
                control={form.control}
                name={drumIdPath}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Drum</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value)
                          // Reset quantity when drum changes
                          form.setValue(quantityPath, '' as unknown as number)
                        }}
                        value={field.value || undefined}
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Pilih Drum" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableDrums.map((drum) => {
                            const isUsed =
                              usedDrumIds.has(drum.id) ||
                              (usedDrumIdsInThisMaterial.has(drum.id) &&
                                drum.id !== selectedDrumId)
                            const availableStock = getAvailableStock(
                              selectedMaterial.id,
                              drum.id
                            )
                            const isDisabled = availableStock <= 0 || isUsed
                            return (
                              <SelectItem
                                key={drum.id}
                                value={drum.id}
                                disabled={isDisabled}
                              >
                                {drum.label} (Sisa:{' '}
                                {availableStock.toLocaleString()}){' '}
                                {availableStock <= 0 ? '(Habis)' : ''}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={quantityPath}
                render={({ field }) => {
                  const isQuantityDisabled = !selectedDrumId

                  return (
                    <FormItem className="w-32">
                      <FormLabel>Jumlah</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
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
                      {selectedDrum &&
                        !isQuantityDisabled &&
                        getAvailableStock(selectedMaterial.id, selectedDrumId) >
                          0 && (
                          <p className="text-muted-foreground text-xs">
                            Tersedia:{' '}
                            {getAvailableStock(
                              selectedMaterial.id,
                              selectedDrumId
                            ).toLocaleString()}
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
                className="hover:bg-destructive/10 hover:text-destructive mt-8 h-9 w-9 shrink-0"
                onClick={() => removeDrum(drumIndex)}
                disabled={drumFields.length === 1}
                aria-label="Hapus drum"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          addDrum({ drumId: '', quantity: '' as unknown as number })
        }
        className="w-full border-dashed"
        disabled={
          availableDrums.length === 0 ||
          drumFields.length >= availableDrums.length
        }
      >
        <Plus className="mr-2 h-4 w-4" />
        Tambah Drum
      </Button>
    </div>
  )
}

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
  const form = useForm<BatchFormData>({
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
      // Group batchUsages by rawMaterialId and convert to nested structure
      const materialsMap = new Map<
        string,
        Array<{ drumId: string; quantity: number }>
      >()

      for (const usage of batch.batchUsages) {
        if (!materialsMap.has(usage.rawMaterialId)) {
          materialsMap.set(usage.rawMaterialId, [])
        }
        const drums = materialsMap.get(usage.rawMaterialId)!
        drums.push({
          drumId: usage.drumId || '',
          quantity: usage.quantity,
        })
      }

      const materials = Array.from(materialsMap.entries()).map(
        ([rawMaterialId, drums]) => ({
          rawMaterialId,
          drums,
        })
      )

      form.reset({
        code: batch.code,
        date: new Date(batch.date),
        description: batch.description || '',
        materials,
      })
    }
  }, [batch, open, form])

  const { handleSubmit: handleFormSubmit, isLoading } = useFormSubmission({
    onSubmit: async (data: BatchFormData) => {
      if (!batch) return

      // Transform nested structure to match API format
      const transformedMaterials = data.materials.map((material) => ({
        rawMaterialId: material.rawMaterialId,
        drums: material.drums.map((drum) => ({
          drumId: drum.drumId,
          quantity: drum.quantity,
        })),
      }))

      const response = await fetch(`/api/batches/${batch.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: data.code,
          date: data.date.toISOString(),
          description: data.description,
          materials: transformedMaterials,
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

            <Card className="border-2 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold">
                  Bahan Baku yang Digunakan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-subsection pt-0">
                {fields.map((field, materialIndex) => {
                  const selectedMaterialId = form.watch(
                    `materials.${materialIndex}.rawMaterialId`
                  )
                  const selectedMaterial = rawMaterials.find(
                    (m) => m.id === selectedMaterialId
                  )
                  const hasDrums =
                    selectedMaterial?.drums && selectedMaterial.drums.length > 0

                  // Get all used drums across all materials
                  const allMaterials = form.watch('materials') as BatchFormData['materials']
                  const usedDrumIds = new Set<string>()
                  for (const mat of allMaterials) {
                    if (mat.rawMaterialId) {
                      for (const drum of mat.drums) {
                        if (drum.drumId) {
                          usedDrumIds.add(drum.drumId)
                        }
                      }
                    }
                  }

                  // Get drums used in this material (to prevent duplicates within same material)
                  const drumsInThisMaterial =
                    allMaterials[materialIndex]?.drums || []
                  const usedDrumIdsInThisMaterial = new Set(
                    drumsInThisMaterial.map((d) => d.drumId).filter((id) => id)
                  )

                  return (
                    <Card
                      key={field.id}
                      className="border-2 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base font-semibold">
                            Bahan Baku {materialIndex + 1}
                          </CardTitle>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                            onClick={() => remove(materialIndex)}
                            disabled={fields.length === 1}
                            aria-label="Hapus bahan baku"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-subsection pt-0">
                        <FormField
                          control={form.control}
                          name={`materials.${materialIndex}.rawMaterialId`}
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>Bahan Baku</FormLabel>
                              <FormControl>
                                <Select
                                  onValueChange={(val) => {
                                    field.onChange(val)
                                    // Reset drums when material changes
                                    form.setValue(
                                      `materials.${materialIndex}.drums`,
                                      [
                                        {
                                          drumId: '',
                                          quantity: '' as unknown as number,
                                        },
                                      ]
                                    )
                                  }}
                                  value={field.value}
                                >
                                  <SelectTrigger className="w-full [&>span]:truncate">
                                    <SelectValue placeholder="Pilih bahan baku" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {sortedRawMaterials.length === 0 ? (
                                      <div className="text-muted-foreground px-2 py-6 text-center text-sm">
                                        Tidak ada bahan baku tersedia
                                      </div>
                                    ) : (
                                      <>
                                        {sortedRawMaterials.map((material) => {
                                          // Filter out already selected materials (except current one)
                                          const isAlreadySelected = allMaterials.some(
                                            (m, idx) =>
                                              idx !== materialIndex &&
                                              m.rawMaterialId === material.id
                                          )
                                          if (isAlreadySelected) return null

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
                                                  {material.kode} -{' '}
                                                  {material.name}
                                                </span>
                                                {availableStock > 0 ? (
                                                  <span className="shrink-0 font-medium whitespace-nowrap text-green-600 dark:text-green-400">
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
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {selectedMaterialId && hasDrums && (
                          <div className="space-subsection">
                            <div className="mb-2 flex items-center justify-between">
                              <h4 className="text-sm font-medium">Drum</h4>
                            </div>
                            {selectedMaterial && (
                              <MaterialDrumsFieldArray
                                materialIndex={materialIndex}
                                selectedMaterial={selectedMaterial}
                                usedDrumIds={usedDrumIds}
                                usedDrumIdsInThisMaterial={
                                  usedDrumIdsInThisMaterial
                                }
                                form={form}
                                batch={batch}
                                getAvailableStock={getAvailableStock}
                              />
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    append({
                      rawMaterialId: '',
                      drums: [
                        { drumId: '', quantity: '' as unknown as number },
                      ],
                    })
                  }
                  className="hover:bg-muted/50 w-full border-dashed transition-colors hover:border-solid"
                  disabled={isLoading}
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
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memperbarui...
                  </>
                ) : (
                  'Perbarui'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
