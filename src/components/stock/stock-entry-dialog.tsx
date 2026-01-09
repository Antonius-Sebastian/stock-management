'use client'

import { useState, useEffect, useMemo } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { ItemSelector, DatePickerField } from '@/components/forms'
import { useFormSubmission } from '@/lib/hooks'
import type { Item } from '@/lib/types'
import { Loader2 } from 'lucide-react'

interface Location {
  id: string
  name: string
  isDefault: boolean
}

const createFormSchema = (
  items: Item[],
  type: 'in' | 'out' | 'IN' | 'OUT',
  itemType: 'raw-material' | 'finished-good',
  _defaultLocationId?: string
) => {
  const normalizedType = typeof type === 'string' ? type.toUpperCase() : type
  const isRawMaterial = itemType === 'raw-material'

  const baseSchema = z.object({
    itemId: z.string().min(1, 'Silakan pilih item'),
    quantity: z.coerce
      .number({
        required_error: 'Jumlah wajib diisi',
        invalid_type_error: 'Jumlah harus berupa angka',
      })
      .refine(
        (val) => !isNaN(val) && val > 0,
        'Jumlah harus lebih besar dari nol'
      )
      .optional(),
    date: z.date({
      required_error: 'Silakan pilih tanggal',
    }),
    description: z.string().optional(),
    locationId: z.string().optional(),
    batchCode: z.string().optional(),
    drumId: z.string().optional(),
  })

  return baseSchema
    .refine(
      (data) => {
        // For raw materials, drumId is required
        if (isRawMaterial) {
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
        // For raw materials, quantity is required when drumId is selected
        if (isRawMaterial && data.drumId) {
          return data.quantity !== undefined && data.quantity > 0
        }
        // For finished goods OUT, quantity is required
        if (itemType === 'finished-good' && normalizedType === 'OUT') {
          return data.quantity !== undefined && data.quantity > 0
        }
        // For finished goods IN, quantity is required
        if (itemType === 'finished-good' && normalizedType === 'IN') {
          return data.quantity !== undefined && data.quantity > 0
        }
        return true
      },
      {
        message: 'Jumlah wajib diisi',
        path: ['quantity'],
      }
    )
    .refine(
      (data) => {
        if (normalizedType === 'OUT') {
          const selectedItem = items.find((item) => item.id === data.itemId)
          if (isRawMaterial && data.drumId && selectedItem) {
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
              return (data.quantity || 0) <= selectedDrum.currentQuantity
            }
          } else if (
            itemType === 'finished-good' &&
            selectedItem &&
            data.locationId
          ) {
            // For finished goods OUT, check location-specific stock
            const itemWithStocks = selectedItem as Item & {
              stocks?: Array<{ locationId: string; quantity: number }>
            }
            if (itemWithStocks.stocks) {
              const stock = itemWithStocks.stocks.find(
                (s) => s.locationId === data.locationId
              )
              if (stock) {
                return (data.quantity || 0) <= stock.quantity
              }
            }
            // Fallback: if no location stock found, check aggregate (shouldn't happen due to filtering)
            if ('currentStock' in selectedItem) {
              return (
                (data.quantity || 0) <=
                (selectedItem as Item & { currentStock: number }).currentStock
              )
            }
          } else if (selectedItem && 'currentStock' in selectedItem) {
            // Fallback for other cases
            return (
              (data.quantity || 0) <=
              (selectedItem as Item & { currentStock: number }).currentStock
            )
          }
        }
        return true
      },
      {
        message: 'Jumlah tidak boleh melebihi stok yang tersedia',
        path: ['quantity'],
      }
    )
    .refine(
      (data) => {
        if (itemType === 'finished-good' && normalizedType === 'IN') {
          return data.locationId && data.locationId.trim() !== ''
        }
        return true
      },
      {
        message: 'Lokasi harus dipilih untuk stok masuk produk jadi',
        path: ['locationId'],
      }
    )
}

interface StockEntryDialogProps {
  type: 'in' | 'out' | 'IN' | 'OUT'
  itemType?: 'raw-material' | 'finished-good'
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

export function StockEntryDialog({
  type,
  itemType,
  entityType,
  entityId,
  entityName: _entityName,
  onSuccess,
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultLocationId,
}: StockEntryDialogProps) {
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
  const normalizedType = typeof type === 'string' ? type.toUpperCase() : type
  const isRawMaterial = actualItemType === 'raw-material'

  const formSchema = createFormSchema(
    items,
    type,
    actualItemType,
    defaultLocationId
  )
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      itemId: entityId || '',
      quantity: '' as unknown as number,
      date: new Date(),
      description: '',
      locationId: '', // Default empty, will be required for FG
      batchCode: '',
      drumId: '',
    },
    mode: 'onSubmit',
  })

  const fetchItems = async (signal?: AbortSignal) => {
    try {
      let endpoint =
        actualItemType === 'raw-material'
          ? '/api/raw-materials'
          : '/api/finished-goods'

      // Include drums for raw materials (both IN and OUT)
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
      toast.error('Gagal memuat item. Silakan coba lagi.')
    }
  }

  const fetchLocations = async (signal?: AbortSignal) => {
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
      if (actualItemType === 'finished-good') {
        fetchLocations(controller.signal)
      }
    } else {
      // Reset form when dialog closes
      form.reset({
        itemId: entityId || '',
        quantity: '' as unknown as number,
        date: new Date(),
        description: '',
        locationId: '',
        batchCode: '',
        drumId: '',
      })
    }

    // Cleanup function to abort fetch on unmount or dependency change
    return () => {
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, actualItemType, entityId, form])

  // Update form when entityId changes
  useEffect(() => {
    if (entityId && open) {
      // Use setTimeout to avoid synchronous setState in effect
      const timeoutId = setTimeout(() => {
        form.setValue('itemId', entityId)
      }, 0)
      return () => clearTimeout(timeoutId)
    }
  }, [entityId, open, form])

  // Watch locationId for finished goods OUT filtering
  const selectedLocationId = form.watch('locationId')

  // Client-side filtering for finished goods based on location
  const filteredItems = useMemo(() => {
    // For finished goods IN or OUT, filter by selected location
    if (actualItemType === 'finished-good') {
      // For finished goods IN, show ALL items (not filtered by stock)
      // But when displaying stock, show location-specific stock
      if (normalizedType === 'IN') {
        if (!selectedLocationId) return [] // Require location selection for IN

        // Show all finished goods, regardless of stock
        return items
      }

      // For finished goods OUT, filter by selected location and show only items with stock > 0
      if (normalizedType === 'OUT') {
        if (!selectedLocationId) return []

        return items.filter((item) => {
          const itemWithStocks = item as Item & {
            stocks?: Array<{ locationId: string; quantity: number }>
          }
          if (!itemWithStocks.stocks) return false

          const stock = itemWithStocks.stocks.find(
            (s) => s.locationId === selectedLocationId
          )
          return stock && stock.quantity > 0
        })
      }
    }

    // For raw materials, use existing filtering logic
    const isOutMovement = normalizedType === 'OUT'
    return isOutMovement
      ? items.filter((i) => (i.currentStock ?? 0) > 0)
      : items
  }, [items, actualItemType, normalizedType, selectedLocationId])

  const { handleSubmit: handleFormSubmit, isLoading } = useFormSubmission({
    onSubmit: async (data: FormData) => {
      // Regular stock movement endpoint with drumId for raw materials
      const stockMovementData = {
        type: normalizedType,
        quantity: data.quantity || 0,
        date: data.date.toISOString(),
        ...(actualItemType === 'raw-material'
          ? { rawMaterialId: data.itemId, drumId: data.drumId }
          : { finishedGoodId: data.itemId, locationId: data.locationId }),
        description: data.description,
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
        throw new Error(errorData.error || 'Gagal mencatat pergerakan stok')
      }

      const actionType = normalizedType === 'IN' ? 'incoming' : 'outgoing'
      const itemTypeLabel =
        actualItemType === 'raw-material' ? 'bahan baku' : 'produk jadi'

      toast.success(
        `Berhasil mencatat stok ${actionType === 'incoming' ? 'masuk' : 'keluar'} untuk ${itemTypeLabel}`
      )
      form.reset({
        itemId: entityId || '',
        quantity: '' as unknown as number,
        date: new Date(),
        description: '',
        locationId: '',
        batchCode: '',
        drumId: '',
      })
      setOpen(false)
      onSuccess()
    },
    errorMessage: 'Gagal mencatat pergerakan stok',
  })

  const getTitle = () => {
    const normalizedType = typeof type === 'string' ? type.toUpperCase() : type
    const action =
      normalizedType === 'IN' ? 'Input Stok Masuk' : 'Input Stok Keluar'
    const itemTypeLabel =
      actualItemType === 'raw-material' ? 'Bahan Baku' : 'Produk Jadi'
    if (_entityName) {
      return `${action} - ${_entityName}`
    }
    return `${action} - ${itemTypeLabel}`
  }

  const getDescription = () => {
    const normalizedType = typeof type === 'string' ? type.toUpperCase() : type
    const action = normalizedType === 'IN' ? 'masuk' : 'keluar'
    const itemTypeLabel =
      actualItemType === 'raw-material' ? 'bahan baku' : 'produk jadi'
    return `Catat stok ${action} untuk ${itemTypeLabel}`
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="max-w-[95vw] sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="truncate">{getTitle()}</DialogTitle>
          <DialogDescription className="truncate">
            {getDescription()}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleFormSubmit)}
            className="space-form overflow-hidden"
          >
            {/* Location selector for finished goods IN and OUT - show first */}
            {actualItemType === 'finished-good' && !entityId && (
              <FormField
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lokasi</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value)
                        // Reset item selection when location changes
                        form.setValue('itemId', '')
                      }}
                      defaultValue={field.value || defaultLocationId}
                      value={field.value || defaultLocationId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih lokasi" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {!entityId && (
              <FormField
                control={form.control}
                name="itemId"
                render={({ field }) => {
                  const normalizedType =
                    typeof type === 'string' ? type.toUpperCase() : type
                  const isFinishedGood = actualItemType === 'finished-good'

                  // Use filteredItems for finished goods (IN and OUT), otherwise use existing logic
                  const availableItems = isFinishedGood
                    ? filteredItems
                    : normalizedType === 'OUT'
                      ? items.filter((i) => (i.currentStock ?? 0) > 0)
                      : items

                  return (
                    <FormItem className="flex min-w-0 flex-col">
                      <FormLabel>
                        {actualItemType === 'raw-material'
                          ? 'Bahan Baku'
                          : 'Produk Jadi'}
                      </FormLabel>
                      <FormControl>
                        <ItemSelector
                          items={availableItems}
                          itemType={actualItemType}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder={`Pilih ${
                            actualItemType === 'raw-material'
                              ? 'bahan baku'
                              : 'produk jadi'
                          }`}
                          disabled={isFinishedGood && !form.watch('locationId')}
                        />
                      </FormControl>
                      {isFinishedGood &&
                        normalizedType === 'OUT' &&
                        filteredItems.length === 0 &&
                        form.watch('locationId') && (
                          <p className="text-muted-foreground text-xs">
                            Tidak ada produk dengan stok di lokasi ini
                          </p>
                        )}
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />
            )}
            {/* Drum selection for raw materials */}
            {isRawMaterial && (
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
                    selectedItem?.drums?.filter((drum) => {
                      if (normalizedType === 'OUT') {
                        // For OUT, only show drums with available stock
                        return drum.currentQuantity > 0 && drum.isActive
                      }
                      // For IN, show all active drums
                      return drum.isActive
                    }) || []

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
                              <div className="text-muted-foreground py-2 text-center text-sm">
                                {!selectedItemId
                                  ? 'Pilih bahan baku terlebih dahulu'
                                  : normalizedType === 'OUT'
                                    ? 'Tidak ada drum dengan stok tersedia'
                                    : 'Tidak ada drum tersedia'}
                              </div>
                            ) : (
                              availableDrums.map((drum) => (
                                <SelectItem
                                  key={drum.id}
                                  value={drum.id}
                                  disabled={drum.currentQuantity <= 0}
                                >
                                  {drum.label} (Sisa:{' '}
                                  {drum.currentQuantity.toLocaleString()}){' '}
                                  {drum.currentQuantity <= 0 ? '(Habis)' : ''}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      {selectedItemId && availableDrums.length === 0 && (
                        <p className="text-muted-foreground text-xs">
                          {normalizedType === 'OUT'
                            ? 'Tidak ada drum dengan stok tersedia untuk bahan baku ini'
                            : 'Tidak ada drum tersedia untuk bahan baku ini'}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />
            )}

            {/* Quantity field - shown for all types */}
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => {
                const selectedItemId = form.watch('itemId')
                const selectedItem = items.find(
                  (item) => item.id === selectedItemId
                )
                const selectedDrumId = form.watch('drumId')

                // For raw materials, get stock from selected drum
                let availableStock = 0
                if (isRawMaterial && selectedItem && selectedDrumId) {
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
                  availableStock = selectedDrum?.currentQuantity || 0
                } else if (actualItemType === 'finished-good' && selectedItem) {
                  // For finished goods (both IN and OUT), get stock from selected location
                  const selectedLocId =
                    form.watch('locationId') || defaultLocationId
                  const itemWithStocks = selectedItem as Item & {
                    stocks?: Array<{ locationId: string; quantity: number }>
                  }
                  if (selectedLocId && itemWithStocks.stocks) {
                    const stock = itemWithStocks.stocks.find(
                      (s) => s.locationId === selectedLocId
                    )
                    availableStock = stock?.quantity || 0
                  }
                } else if (selectedItem && 'currentStock' in selectedItem) {
                  availableStock = (
                    selectedItem as Item & { currentStock: number }
                  ).currentStock
                }

                const isQuantityDisabled = isRawMaterial && !selectedDrumId

                return (
                  <FormItem className="min-w-0">
                    <FormLabel>Jumlah</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Masukkan jumlah"
                        disabled={isQuantityDisabled}
                        {...field}
                      />
                    </FormControl>
                    {isQuantityDisabled && (
                      <p className="text-muted-foreground text-xs">
                        Pilih drum terlebih dahulu
                      </p>
                    )}
                    {!isQuantityDisabled &&
                      normalizedType === 'OUT' &&
                      availableStock > 0 && (
                        <p className="text-muted-foreground text-xs">
                          Tersedia: {availableStock.toLocaleString()}
                        </p>
                      )}
                    {isRawMaterial &&
                      selectedDrumId &&
                      availableStock > 0 &&
                      normalizedType === 'IN' && (
                        <p className="text-muted-foreground text-xs">
                          Stok saat ini: {availableStock.toLocaleString()}
                        </p>
                      )}
                    {actualItemType === 'finished-good' &&
                      normalizedType === 'IN' &&
                      selectedItem &&
                      availableStock > 0 && (
                        <p className="text-muted-foreground text-xs">
                          Stok saat ini di lokasi ini:{' '}
                          {availableStock.toLocaleString()}
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
                <FormItem className="flex min-w-0 flex-col">
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

            {/* Batch code removed for finished goods OUT per requirements */}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel>Deskripsi (Opsional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Masukkan deskripsi" {...field} />
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
                    Mencatat...
                  </>
                ) : (
                  'Catat'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
