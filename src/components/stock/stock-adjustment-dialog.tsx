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
import { Loader2 } from 'lucide-react'
import type { Item } from '@/lib/types'
import { getWIBDate } from '@/lib/timezone'

interface Location {
  id: string
  name: string
  isDefault: boolean
}

const createFormSchema = (
  items: Item[],
  itemType: 'raw-material' | 'finished-good'
) =>
  z
    .object({
      itemId: z.string().min(1, 'Silakan pilih item'),
      newStock: z.coerce
        .number({
          required_error: 'Stok baru wajib diisi',
          invalid_type_error: 'Stok baru harus berupa angka',
        })
        .min(0, 'Stok baru tidak boleh negatif')
        .max(1000000, 'Stok baru tidak boleh melebihi 1,000,000'),
      date: z.date({
        required_error: 'Silakan pilih tanggal',
      }),
      description: z
        .string()
        .min(1, 'Alasan wajib diisi untuk penyesuaian stok'),
      drumId: z.string().optional(),
      locationId: z.string().optional(),
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
        // For finished goods, locationId is required
        if (itemType === 'finished-good') {
          return data.locationId && data.locationId.trim() !== ''
        }
        return true
      },
      {
        message: 'Lokasi wajib dipilih untuk produk jadi',
        path: ['locationId'],
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
  defaultLocationId?: string
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
  defaultLocationId,
}: StockAdjustmentDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [locations, setLocations] = useState<Location[]>([])

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
      newStock: '' as unknown as number,
      date: getWIBDate(),
      description: '',
      drumId: '',
      locationId: defaultLocationId || '',
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

  const fetchLocations = async (signal: AbortSignal) => {
    try {
      const res = await fetch('/api/locations', { signal })
      if (!res.ok) throw new Error('Failed to fetch locations')
      const data = await res.json()
      setLocations(data)

      // Auto-select default location: use defaultLocationId prop if provided, otherwise use default location or first location
      if (
        defaultLocationId &&
        data.find((l: Location) => l.id === defaultLocationId)
      ) {
        form.setValue('locationId', defaultLocationId)
      } else {
        const defaultLoc = data.find((l: Location) => l.isDefault)
        if (defaultLoc) {
          form.setValue('locationId', defaultLoc.id)
        } else if (data.length > 0) {
          form.setValue('locationId', data[0].id)
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      console.error('Failed to fetch locations', error)
    }
  }

  useEffect(() => {
    // Create AbortController for cleanup
    const controller = new AbortController()

    if (open) {
      fetchItems(controller.signal)
      // Fetch locations for finished goods
      if (actualItemType === 'finished-good') {
        fetchLocations(controller.signal)
      }
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
        newStock: data.newStock,
        date: data.date.toISOString(),
        description: data.description || 'Stock adjustment',
        ...(actualItemType === 'raw-material'
          ? { rawMaterialId: data.itemId, drumId: data.drumId }
          : { finishedGoodId: data.itemId, locationId: data.locationId }),
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

      toast.success(`Berhasil menyesuaikan stok untuk ${itemTypeLabel}`)
      form.reset({
        itemId: entityId || '',
        newStock: '' as unknown as number,
        date: getWIBDate(),
        description: '',
        drumId: '',
        locationId: defaultLocationId || '',
      })
      setOpen(false)
      onSuccess()
    },
    successMessage: undefined, // Custom message handled in onSubmit
    errorMessage: 'Failed to adjust stock',
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Penyesuaian Stok</DialogTitle>
          <DialogDescription>
            Sesuaikan level stok secara manual. Masukkan jumlah stok baru yang
            diinginkan. Sistem akan menghitung selisihnya secara otomatis.
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

            {/* Location selection for finished goods */}
            {actualItemType === 'finished-good' && (
              <FormField
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lokasi</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value)
                          // Reset newStock when location changes
                          form.setValue('newStock', '' as unknown as number)
                        }}
                        value={field.value || defaultLocationId || undefined}
                        defaultValue={
                          field.value || defaultLocationId || undefined
                        }
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Pilih lokasi" />
                        </SelectTrigger>
                        <SelectContent>
                          {locations.length === 0 ? (
                            <div className="text-muted-foreground py-2 text-center text-sm">
                              Memuat lokasi...
                            </div>
                          ) : (
                            locations.map((loc) => (
                              <SelectItem key={loc.id} value={loc.id}>
                                {loc.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
                            // Reset newStock when drum changes
                            form.setValue('newStock', '' as unknown as number)
                          }}
                          value={field.value || undefined}
                          disabled={!selectedItemId}
                        >
                          <SelectTrigger className="h-9 w-full">
                            <SelectValue placeholder="Pilih Drum" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableDrums.length === 0 ? (
                              <div className="text-muted-foreground py-2 text-center text-sm">
                                {!selectedItemId
                                  ? 'Pilih bahan baku terlebih dahulu'
                                  : 'Tidak ada drum tersedia'}
                              </div>
                            ) : (
                              availableDrums.map((drum) => (
                                <SelectItem key={drum.id} value={drum.id}>
                                  {drum.label} (Sisa:{' '}
                                  {drum.currentQuantity.toLocaleString()}
                                  {drum.currentQuantity === 0 && ' - Kosong'})
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

              if (
                actualItemType === 'raw-material' &&
                selectedDrumId &&
                selectedItem
              ) {
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
              } else if (selectedItem && 'currentStock' in selectedItem) {
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
              name="newStock"
              render={({ field }) => {
                const selectedItemId = form.watch('itemId')
                const selectedDrumId = form.watch('drumId')
                const selectedItem = items.find(
                  (item) => item.id === selectedItemId
                )

                const selectedLocationId =
                  form.watch('locationId') || defaultLocationId
                let currentStock: number | null = null

                // Get available drums for raw materials to check if any are available
                const availableDrumsForCheck =
                  actualItemType === 'raw-material' && selectedItem
                    ? (
                        selectedItem as Item & {
                          drums?: Array<{
                            id: string
                            currentQuantity: number
                            isActive: boolean
                          }>
                        }
                      )?.drums?.filter((drum) => drum.isActive) || []
                    : []

                if (
                  actualItemType === 'raw-material' &&
                  selectedDrumId &&
                  selectedItem
                ) {
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
                  actualItemType === 'finished-good' &&
                  selectedLocationId &&
                  selectedItem
                ) {
                  // For finished goods, get location-specific stock
                  const itemWithStocks = selectedItem as Item & {
                    stocks?: Array<{ locationId: string; quantity: number }>
                  }
                  if (itemWithStocks.stocks) {
                    const stock = itemWithStocks.stocks.find(
                      (s) => s.locationId === selectedLocationId
                    )
                    currentStock = stock?.quantity || 0
                  }
                } else if (selectedItem && 'currentStock' in selectedItem) {
                  currentStock = (
                    selectedItem as Item & { currentStock: number }
                  ).currentStock
                }

                const isNewStockDisabled =
                  (actualItemType === 'raw-material' &&
                    (!selectedDrumId || availableDrumsForCheck.length === 0)) ||
                  (actualItemType === 'finished-good' &&
                    !form.watch('locationId'))
                const newStockValue = form.watch('newStock')
                const adjustmentAmount =
                  currentStock !== null &&
                  newStockValue !== undefined &&
                  typeof newStockValue === 'number' &&
                  !isNaN(newStockValue)
                    ? newStockValue - currentStock
                    : null

                return (
                  <FormItem>
                    <FormLabel>Stok Baru</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Masukkan jumlah stok baru"
                        disabled={isNewStockDisabled}
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => {
                          const value =
                            e.target.value === '' ? '' : Number(e.target.value)
                          field.onChange(value)
                        }}
                      />
                    </FormControl>
                    {isNewStockDisabled && (
                      <p className="text-muted-foreground text-xs">
                        {actualItemType === 'raw-material'
                          ? 'Pilih drum terlebih dahulu'
                          : 'Pilih lokasi terlebih dahulu'}
                      </p>
                    )}
                    {currentStock !== null && !isNewStockDisabled && (
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-xs">
                          Stok Saat Ini:{' '}
                          <span className="font-medium">
                            {currentStock.toLocaleString()}
                          </span>
                        </p>
                        {adjustmentAmount !== null && (
                          <p className="text-muted-foreground text-xs">
                            Penyesuaian:{' '}
                            <span
                              className={`font-medium ${
                                adjustmentAmount > 0
                                  ? 'text-green-600 dark:text-green-400'
                                  : adjustmentAmount < 0
                                    ? 'text-red-600 dark:text-red-400'
                                    : ''
                              }`}
                            >
                              {adjustmentAmount > 0 ? '+' : ''}
                              {adjustmentAmount.toLocaleString()}
                            </span>
                          </p>
                        )}
                      </div>
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
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Menyesuaikan...
                  </>
                ) : (
                  'Sesuaikan Stok'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
