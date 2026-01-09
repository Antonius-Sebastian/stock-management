'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import { ItemSelector, DatePickerField } from '@/components/forms'
import { useFormSubmission } from '@/lib/hooks'
import type { Item } from '@/lib/types'
import { getWIBDate } from '@/lib/timezone'

const createFormSchema = (
  items: Item[],
  itemType: 'raw-material' | 'finished-good'
) =>
  z
    .object({
      itemId: z.string().min(1, 'Silakan pilih item'),
      quantity: z.coerce
        .number({
          required_error: 'Jumlah wajib diisi',
          invalid_type_error: 'Jumlah harus berupa angka',
        })
        .refine((val) => !isNaN(val) && val !== 0, 'Jumlah tidak boleh nol'),
      date: z.date({
        required_error: 'Silakan pilih tanggal',
      }),
      description: z.string().min(1, 'Alasan wajib diisi untuk penyesuaian stok'),
      drumId: z.string().optional(),
    })
    .refine(
      (data) => {
        // For raw materials, drumId is required
        if (itemType === 'raw-material') {
          return data.drumId && data.drumId.trim() !== ''
        }
        return true
      },
      {
        message: 'Drum wajib dipilih untuk bahan baku',
        path: ['drumId'],
      }
    )
    .refine(
      (data) => {
        const selectedItem = items.find((item) => item.id === data.itemId)
        if (itemType === 'raw-material' && data.drumId && selectedItem) {
          // For raw materials, check drum stock
          const itemWithDrums = selectedItem as Item & {
            drums?: Array<{
              id: string
              currentQuantity: number
            }>
          }
          const selectedDrum = itemWithDrums.drums?.find(
            (d) => d.id === data.drumId
          )
          if (selectedDrum) {
            const newStock = selectedDrum.currentQuantity + data.quantity
            return newStock >= 0
          }
        } else if (selectedItem && 'currentStock' in selectedItem) {
          // For finished goods, check item stock
          const currentStock = (selectedItem as Item & { currentStock: number })
            .currentStock
          const newStock = currentStock + data.quantity
          return newStock >= 0
        }
        return true
      },
      {
        message: 'Penyesuaian akan menghasilkan stok negatif',
        path: ['quantity'],
      }
    )

interface StockAdjustmentDialogProps {
  itemType: 'raw-material' | 'finished-good'
  entityType?: 'raw-material' | 'finished-good'
  entityId?: string
  entityName?: string
  onSuccess: () => void
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

type FormData = z.infer<ReturnType<typeof createFormSchema>>

export function StockAdjustmentDialog({
  itemType,
  entityType,
  entityId,
  entityName: _entityName,
  onSuccess,
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: StockAdjustmentDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [items, setItems] = useState<Item[]>([])

  // Use controlled or uncontrolled state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen =
    controlledOnOpenChange !== undefined
      ? controlledOnOpenChange
      : setInternalOpen

  // Determine the actual item type to use
  const actualItemType = entityType || itemType || 'raw-material'

  const formSchema = createFormSchema(items, actualItemType)
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      itemId: entityId || '',
      quantity: '' as unknown as number,
      date: getWIBDate(),
      description: '',
      drumId: '',
    },
    mode: 'onSubmit',
  })

  const fetchItems = async (signal: AbortSignal) => {
    try {
      let endpoint =
        actualItemType === 'raw-material'
          ? '/api/raw-materials'
          : '/api/finished-goods'

      // Include drums for raw materials
      if (actualItemType === 'raw-material') {
        endpoint += '?include=drums'
      }

      const response = await fetch(endpoint, { signal })
      if (!response.ok) {
        throw new Error('Failed to fetch items')
      }
      const data = await response.json()
      // Handle both array response and paginated response
      const items = Array.isArray(data) ? data : data.data || []
      setItems(items)
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

      toast.error('Failed to load items. Please try again.')
    }
  }

  useEffect(() => {
    // Create AbortController for cleanup
    const controller = new AbortController()

    if (open) {
      fetchItems(controller.signal)
    }

    // Cleanup function to abort fetch on unmount or dependency change
    return () => {
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, actualItemType])

  // Update form when entityId changes
  useEffect(() => {
    if (entityId && open) {
      form.setValue('itemId', entityId)
    }
  }, [entityId, open, form])

  const { handleSubmit: handleFormSubmit, isLoading } = useFormSubmission({
    onSubmit: async (data: FormData) => {
      const stockMovementData = {
        type: 'ADJUSTMENT',
        quantity: data.quantity,
        date: data.date.toISOString(),
        description: data.description || 'Stock adjustment',
        ...(actualItemType === 'raw-material'
          ? { rawMaterialId: data.itemId, drumId: data.drumId }
          : { finishedGoodId: data.itemId }),
      }

      const response = await fetch('/api/stock-movements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(stockMovementData),
      })

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to adjust stock')
      }

      const itemTypeLabel =
        actualItemType === 'raw-material' ? 'bahan baku' : 'produk jadi'
      const adjustmentType = data.quantity > 0 ? 'meningkatkan' : 'mengurangi'

      toast.success(`Berhasil ${adjustmentType} stok untuk ${itemTypeLabel}`)
      form.reset({
        itemId: entityId || '',
        quantity: '' as unknown as number,
        date: getWIBDate(),
        description: '',
        drumId: '',
      })
      setOpen(false)
      onSuccess()
    },
    successMessage: undefined, // Custom message handled in onSubmit
    errorMessage: 'Failed to adjust stock',
  })

  const selectedItem = items.find((item) => item.id === form.watch('itemId'))
  const currentStock =
    selectedItem && 'currentStock' in selectedItem
      ? (selectedItem as Item & { currentStock: number }).currentStock
      : null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Penyesuaian Stok</DialogTitle>
          <DialogDescription>
            Sesuaikan level stok secara manual. Gunakan nilai positif untuk
            menambah stok, nilai negatif untuk mengurangi stok.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleFormSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="itemId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>
                    {actualItemType === 'raw-material'
                      ? 'Bahan Baku'
                      : 'Produk Jadi'}
                  </FormLabel>
                  <FormControl>
                    <ItemSelector
                      items={items}
                      itemType={actualItemType}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={`Pilih ${
                        actualItemType === 'raw-material'
                          ? 'bahan baku'
                          : 'produk jadi'
                      }`}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Drum selection for raw materials */}
            {actualItemType === 'raw-material' && (
              <FormField
                control={form.control}
                name="drumId"
                render={({ field }) => {
                  const selectedItemId = form.watch('itemId')
                  const selectedItem = items.find(
                    (item) => item.id === selectedItemId
                  ) as Item & {
                    drums?: Array<{
                      id: string
                      label: string
                      currentQuantity: number
                      isActive: boolean
                    }>
                  }

                  const availableDrums =
                    selectedItem?.drums?.filter((drum) => drum.isActive) || []

                  return (
                    <FormItem>
                      <FormLabel>Drum</FormLabel>
                      <FormControl>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value)
                            // Reset quantity when drum changes
                            form.setValue('quantity', '' as unknown as number)
                          }}
                          value={field.value || undefined}
                          disabled={!selectedItemId}
                        >
                          <SelectTrigger className="h-9 w-full">
                            <SelectValue placeholder="Pilih Drum" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableDrums.length === 0 ? (
                              <div className="py-2 text-center text-sm text-muted-foreground">
                                {!selectedItemId
                                  ? 'Pilih bahan baku terlebih dahulu'
                                  : 'Tidak ada drum tersedia'}
                              </div>
                            ) : (
                              availableDrums.map((drum) => (
                                <SelectItem key={drum.id} value={drum.id}>
                                  {drum.label} (Sisa:{' '}
                                  {drum.currentQuantity.toLocaleString()})
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      {selectedItemId && availableDrums.length === 0 && (
                        <p className="text-muted-foreground text-xs">
                          Tidak ada drum tersedia untuk bahan baku ini
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />
            )}

            {/* Stock display - show drum stock for raw materials, item stock for finished goods */}
            {(() => {
              const selectedItemId = form.watch('itemId')
              const selectedDrumId = form.watch('drumId')
              const selectedItem = items.find(
                (item) => item.id === selectedItemId
              )

              let displayStock: number | null = null
              let stockLabel = 'Stok Saat Ini'

              if (actualItemType === 'raw-material' && selectedDrumId && selectedItem) {
                const itemWithDrums = selectedItem as Item & {
                  drums?: Array<{
                    id: string
                    label: string
                    currentQuantity: number
                  }>
                }
                const selectedDrum = itemWithDrums.drums?.find(
                  (d) => d.id === selectedDrumId
                )
                if (selectedDrum) {
                  displayStock = selectedDrum.currentQuantity
                  stockLabel = 'Stok Drum Saat Ini'
                }
              } else if (
                selectedItem &&
                'currentStock' in selectedItem
              ) {
                displayStock = (selectedItem as Item & { currentStock: number })
                  .currentStock
              }

              return (
                displayStock !== null && (
                  <div className="text-muted-foreground text-sm">
                    {stockLabel}:{' '}
                    <span className="font-medium">
                      {displayStock.toLocaleString()}
                    </span>
                  </div>
                )
              )
            })()}

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => {
                const selectedItemId = form.watch('itemId')
                const selectedDrumId = form.watch('drumId')
                const selectedItem = items.find(
                  (item) => item.id === selectedItemId
                )

                let currentStock: number | null = null
                if (actualItemType === 'raw-material' && selectedDrumId && selectedItem) {
                  const itemWithDrums = selectedItem as Item & {
                    drums?: Array<{
                      id: string
                      currentQuantity: number
                    }>
                  }
                  const selectedDrum = itemWithDrums.drums?.find(
                    (d) => d.id === selectedDrumId
                  )
                  currentStock = selectedDrum?.currentQuantity || null
                } else if (
                  selectedItem &&
                  'currentStock' in selectedItem
                ) {
                  currentStock = (selectedItem as Item & { currentStock: number })
                    .currentStock
                }

                const isQuantityDisabled =
                  actualItemType === 'raw-material' && !selectedDrumId

                return (
                  <FormItem>
                    <FormLabel>Jumlah Penyesuaian</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Masukkan nilai positif atau negatif"
                        disabled={isQuantityDisabled}
                        {...field}
                      />
                    </FormControl>
                    {isQuantityDisabled && (
                      <p className="text-muted-foreground text-xs">
                        Pilih drum terlebih dahulu
                      </p>
                    )}
                    {!isQuantityDisabled && (
                      <p className="text-muted-foreground text-xs">
                        Nilai positif menambah stok, nilai negatif mengurangi
                        stok
                      </p>
                    )}
                    {currentStock !== null &&
                      !isQuantityDisabled &&
                      form.watch('quantity') && (
                        <p className="text-muted-foreground text-xs">
                          Stok Baru:{' '}
                          <span className="font-medium">
                            {(
                              currentStock + (form.watch('quantity') || 0)
                            ).toLocaleString()}
                          </span>
                        </p>
                      )}
                    <FormMessage />
                  </FormItem>
                )
              }}
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

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alasan / Deskripsi *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Masukkan alasan penyesuaian stok..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Menyesuaikan...' : 'Sesuaikan Stok'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
