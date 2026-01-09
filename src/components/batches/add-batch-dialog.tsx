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
              // Material wajib punya drum - drumId is always required
              if (!material.rawMaterialId) return true
              const rawMaterial = rawMaterials.find(
                (rm) => rm.id === material.rawMaterialId
              )
              if (rawMaterial?.drums && rawMaterial.drums.length > 0) {
                return !!material.drumId
              }
              // If material has no drums, that's also valid (legacy support)
              return true
            },
            {
              message: 'Drum wajib dipilih untuk bahan baku ini',
              path: ['drumId'],
            }
          )
      )
      .min(1, 'Minimal satu bahan baku wajib dipilih')
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

        const combos = materials.map(
          (m) => `${m.rawMaterialId}:${m.drumId || ''}`
        )
        return combos.length === new Set(combos).size
      }, 'Tidak dapat memilih kombinasi bahan baku & drum yang sama lebih dari sekali')
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
        materials: [{ rawMaterialId: '', quantity: '' as unknown as number }],
      })
    }
  }, [open, form])

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
            className="flex-1 space-subsection overflow-y-auto pr-2"
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
                {materialFields.map((field, index) => (
                  <div
                    key={field.id}
                    className="hover:bg-muted/50 flex flex-col gap-3 rounded-lg border p-3 transition-colors"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex gap-3">
                        <FormField
                          control={form.control}
                          name={`materials.${index}.rawMaterialId`}
                          render={({ field }) => (
                            <FormItem className="flex flex-1 flex-col">
                              <FormLabel>Bahan Baku</FormLabel>
                              <FormControl>
                                <ItemSelector
                                  items={rawMaterials.filter((material) => {
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
                                    // Reset drum and quantity when material changes
                                    form.setValue(
                                      `materials.${index}.drumId`,
                                      undefined
                                    )
                                    form.setValue(
                                      `materials.${index}.quantity`,
                                      '' as unknown as number
                                    )
                                  }}
                                  placeholder="Pilih bahan baku"
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
                          className="hover:bg-destructive/10 hover:text-destructive mt-8 shrink-0"
                          onClick={() => removeMaterial(index)}
                          disabled={materialFields.length === 1}
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
                                    form.setValue(
                                      `materials.${index}.quantity`,
                                      '' as unknown as number
                                    )
                                  }}
                                  value={field.value}
                                >
                                  <SelectTrigger className="h-9 w-full">
                                    <SelectValue placeholder="Pilih Drum (Wajib)" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {selectedMaterial?.drums?.map((drum) => {
                                      const isUsed = isDrumAlreadyUsed(drum.id)
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
                                          {drum.currentQuantity <= 0
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

                          let availableStock =
                            selectedMaterial?.currentStock || 0
                          if (selectedDrumId && selectedMaterial?.drums) {
                            const drum = selectedMaterial.drums.find(
                              (d) => d.id === selectedDrumId
                            )
                            if (drum) availableStock = drum.currentQuantity
                          }

                          return (
                            <FormItem className="w-32">
                              <FormLabel>Qty</FormLabel>
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
                              {selectedMaterial &&
                                !isQuantityDisabled &&
                                availableStock > 0 && (
                                  <p className="text-muted-foreground text-xs">
                                    Tersedia:{' '}
                                    {availableStock.toLocaleString()}
                                  </p>
                                )}
                              <FormMessage />
                            </FormItem>
                          )
                        }}
                      />
                    </div>
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
                {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
                {isLoading ? 'Membuat...' : 'Buat Batch'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
