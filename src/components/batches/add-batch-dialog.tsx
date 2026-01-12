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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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

interface MaterialDrumsFieldArrayProps {
  materialIndex: number
  selectedMaterial: RawMaterial
  usedDrumIds: Set<string>
  usedDrumIdsInThisMaterial: Set<string>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any // Use any to avoid complex type inference issues with nested paths
}

function MaterialDrumsFieldArray({
  materialIndex,
  selectedMaterial,
  usedDrumIds,
  usedDrumIdsInThisMaterial,
  form,
}: MaterialDrumsFieldArrayProps) {
  const drumPath = `materials.${materialIndex}.drums` as const
  const {
    fields: drumFields,
    append: addDrum,
    remove: removeDrum,
  } = useFieldArray({
    control: form.control,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // Always include currently selected drums so SelectValue can display them
  const availableDrums =
    selectedMaterial.drums?.filter(
      (drum) => {
        const isSelected = selectedDrumIdsInThisMaterial.has(drum.id)
        return (
          isSelected ||
          (drum.currentQuantity > 0 && !usedDrumIds.has(drum.id))
        )
      }
    ) || []

  return (
    <div className="space-y-3">
      {drumFields.map((drumField, drumIndex) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const drums = form.watch(drumPath as any) as Array<{
          drumId: string
          quantity: number
        }>
        const selectedDrumId = drums[drumIndex]?.drumId
        const selectedDrum = selectedMaterial.drums?.find(
          (d) => d.id === selectedDrumId
        )

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const drumIdPath = `${drumPath}.${drumIndex}.drumId` as any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                            const isDisabled =
                              drum.currentQuantity <= 0 || isUsed
                            return (
                              <SelectItem
                                key={drum.id}
                                value={drum.id}
                                disabled={isDisabled}
                              >
                                {drum.label} (Sisa:{' '}
                                {drum.currentQuantity.toLocaleString()}){' '}
                                {drum.currentQuantity <= 0 ? '(Habis)' : ''}
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
                        selectedDrum.currentQuantity > 0 && (
                          <p className="text-muted-foreground text-xs">
                            Tersedia:{' '}
                            {selectedDrum.currentQuantity.toLocaleString()}
                          </p>
                        )}
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />
              <Tooltip>
                <TooltipTrigger asChild>
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
                </TooltipTrigger>
                <TooltipContent>Hapus drum</TooltipContent>
              </Tooltip>
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

interface AddBatchDialogProps {
  onSuccess: () => void
}

type BatchFormData = z.infer<ReturnType<typeof createFormSchema>>

export function AddBatchDialog({ onSuccess }: AddBatchDialogProps) {
  const [open, setOpen] = useState(false)
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([])

  const formSchema = createFormSchema(rawMaterials)
  const form = useForm<BatchFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: '',
      date: getWIBDate(),
      description: '',
      materials: [
        {
          rawMaterialId: '',
          drums: [{ drumId: '', quantity: '' as unknown as number }],
        },
      ],
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
      toast.error('Gagal memuat data yang diperlukan. Silakan coba lagi.')
    }
  }

  useEffect(() => {
    if (open) {
      fetchData()
    } else {
      // Reset form when dialog closes
      form.reset({
        code: '',
        date: getWIBDate(),
        description: '',
        materials: [
          {
            rawMaterialId: '',
            drums: [{ drumId: '', quantity: '' as unknown as number }],
          },
        ],
      })
    }
  }, [open, form])

  const { handleSubmit: handleFormSubmit, isLoading } = useFormSubmission({
    onSubmit: async (data: BatchFormData) => {
      // Transform nested structure to match API format
      const transformedMaterials = data.materials.map((material) => ({
        rawMaterialId: material.rawMaterialId,
        drums: material.drums.map((drum) => ({
          drumId: drum.drumId,
          quantity: drum.quantity,
        })),
      }))

      const response = await fetch('/api/batches', {
        method: 'POST',
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
        throw new Error(errorData.error || 'Gagal membuat batch')
      }

      toast.success('Batch berhasil dibuat')
      form.reset()
      setOpen(false)
      onSuccess()
    },
    successMessage: undefined, // Custom message handled in onSubmit
    errorMessage: 'Gagal membuat batch',
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-5 w-5" />
          Catat Pemakaian Baru
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] max-w-[95vw] flex-col sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Catat Pemakaian Baru</DialogTitle>
          <DialogDescription>
            Catat batch produksi baru dengan bahan baku. Pilih drum spesifik
            untuk setiap bahan.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleFormSubmit)}
            className="space-subsection flex-1 overflow-y-auto pr-2"
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
                {materialFields.map((field, materialIndex) => {
                  const selectedMaterialId = form.watch(
                    `materials.${materialIndex}.rawMaterialId`
                  )
                  const selectedMaterial = rawMaterials.find(
                    (m) => m.id === selectedMaterialId
                  )
                  const hasDrums =
                    selectedMaterial?.drums && selectedMaterial.drums.length > 0

                  // Get all used drums across all materials
                  const allMaterials = form.watch('materials')
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
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                                onClick={() => removeMaterial(materialIndex)}
                                disabled={materialFields.length === 1}
                                aria-label="Hapus bahan baku"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Hapus bahan baku</TooltipContent>
                          </Tooltip>
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
                                <ItemSelector
                                  items={rawMaterials.filter((material) => {
                                    // Filter out already selected materials (except current one)
                                    const isAlreadySelected = allMaterials.some(
                                      (m, idx) =>
                                        idx !== materialIndex &&
                                        m.rawMaterialId === material.id
                                    )
                                    if (isAlreadySelected) return false

                                    // Only show materials with stock > 0
                                    // OR materials with drums that have at least one drum with stock > 0
                                    if (material.currentStock > 0) return true
                                    if (
                                      material.drums &&
                                      material.drums.length > 0
                                    ) {
                                      return material.drums.some(
                                        (drum) => drum.currentQuantity > 0
                                      )
                                    }
                                    return false
                                  })}
                                  itemType="raw-material"
                                  value={field.value}
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
                                  placeholder="Pilih bahan baku"
                                />
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
                    addMaterial({
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
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Membuat...
                  </>
                ) : (
                  'Buat Batch'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
