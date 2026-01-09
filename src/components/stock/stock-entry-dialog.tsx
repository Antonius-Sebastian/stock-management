'use client'

import { useState, useEffect, useMemo } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'
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

interface Location {
  id: string
  name: string
  isDefault: boolean
}

const createFormSchema = (
  items: Item[],
  type: 'in' | 'out' | 'IN' | 'OUT',
  itemType: 'raw-material' | 'finished-good'
) => {
  const normalizedType = typeof type === 'string' ? type.toUpperCase() : type
  const isRawMaterialIn = itemType === 'raw-material' && normalizedType === 'IN'

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
    drums: z
      .array(
        z.object({
          label: z.string().min(1, 'Label drum wajib diisi'),
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
      .optional(),
  })

  return baseSchema
    .refine(
      (data) => {
        if (normalizedType === 'OUT') {
          const selectedItem = items.find((item) => item.id === data.itemId)
          if (selectedItem && 'currentStock' in selectedItem) {
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
        if (isRawMaterialIn) {
          // If drums are provided, quantity is optional (sum of drums)
          // If no drums, quantity is required
          if (data.drums && data.drums.length > 0) {
            return true // Drums provided, quantity optional
          }
          return data.quantity !== undefined && data.quantity > 0 // No drums, quantity required
        }
        return true
      },
      {
        message: 'Jumlah atau drum harus diisi',
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
  const isRawMaterialIn =
    actualItemType === 'raw-material' && normalizedType === 'IN'

  const formSchema = createFormSchema(items, type, actualItemType)
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      itemId: entityId || '',
      quantity: '' as unknown as number,
      date: new Date(),
      description: '',
      locationId: '', // Default empty, will be required for FG
      batchCode: '',
      drums: [],
    },
    mode: 'onSubmit',
  })

  const {
    fields: drumFields,
    append: appendDrum,
    remove: removeDrum,
  } = useFieldArray({
    control: form.control,
    name: 'drums',
  })

  const fetchItems = async (signal?: AbortSignal) => {
    try {
      let endpoint =
        actualItemType === 'raw-material'
          ? '/api/raw-materials'
          : '/api/finished-goods'

      // Include drums for raw material IN
      if (isRawMaterialIn) {
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
        drums: [],
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

  // Client-side filtering for finished goods OUT based on location
  const filteredItems = useMemo(() => {
    if (actualItemType !== 'finished-good' || normalizedType !== 'OUT') {
      // For non-finished-good OUT, use existing filtering logic
      const isOutMovement = normalizedType === 'OUT'
      return isOutMovement
        ? items.filter((i) => (i.currentStock ?? 0) > 0)
        : items
    }

    // For finished goods OUT, filter by selected location
    if (!selectedLocationId) return []

    return items.filter((item) => {
      // Check if item has stocks array (extended Item type for finished goods)
      const itemWithStocks = item as Item & {
        stocks?: Array<{ locationId: string; quantity: number }>
      }
      if (!itemWithStocks.stocks) return false

      const stock = itemWithStocks.stocks.find(
        (s) => s.locationId === selectedLocationId
      )
      return stock && stock.quantity > 0
    })
  }, [items, actualItemType, normalizedType, selectedLocationId])

  const { handleSubmit: handleFormSubmit, isLoading } = useFormSubmission({
    onSubmit: async (data: FormData) => {
      // Use drum-in endpoint if drums are provided for raw material IN
      if (isRawMaterialIn && data.drums && data.drums.length > 0) {
        const drumStockInData = {
          rawMaterialId: data.itemId,
          date: data.date,
          description: data.description || undefined,
          drums: data.drums,
        }

        const response = await fetch('/api/stock-movements/drum-in', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(drumStockInData),
        })

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: 'Unknown error' }))
          throw new Error(errorData.error || 'Gagal mencatat stok masuk drum')
        }

        toast.success(
          'Berhasil mencatat stok masuk dengan drum untuk bahan baku'
        )
        form.reset({
          itemId: entityId || '',
          quantity: '' as unknown as number,
          date: new Date(),
          description: '',
          locationId: '',
          batchCode: '',
          drums: [],
        })
        setOpen(false)
        onSuccess()
        return
      }

      // Regular stock movement endpoint
      const stockMovementData = {
        type: normalizedType,
        quantity: data.quantity || 0,
        date: data.date.toISOString(),
        ...(actualItemType === 'raw-material'
          ? { rawMaterialId: data.itemId }
          : { finishedGoodId: data.itemId, locationId: data.locationId }),
        // Append batch code to description if provided
        description: data.batchCode
          ? `${data.description || ''} [Batch: ${data.batchCode}]`.trim()
          : data.description,
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
        drums: [],
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
            {/* Location selector for finished goods OUT - show first */}
            {actualItemType === 'finished-good' &&
              normalizedType === 'OUT' &&
              !entityId && (
                <FormField
                  control={form.control}
                  name="locationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lokasi</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
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
                  const isFinishedGoodOut =
                    actualItemType === 'finished-good' &&
                    normalizedType === 'OUT'

                  // Use filteredItems for finished goods OUT, otherwise use existing logic
                  const availableItems = isFinishedGoodOut
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
                          disabled={
                            isFinishedGoodOut && !form.watch('locationId')
                          }
                        />
                      </FormControl>
                      {isFinishedGoodOut &&
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
            {!isRawMaterialIn && (
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => {
                  const selectedItemId = form.watch('itemId')
                  const selectedItem = items.find(
                    (item) => item.id === selectedItemId
                  )

                  // For finished goods OUT, get stock from selected location
                  let availableStock = selectedItem?.currentStock || 0
                  if (
                    actualItemType === 'finished-good' &&
                    normalizedType === 'OUT' &&
                    selectedItem
                  ) {
                    const selectedLocId = form.watch('locationId')
                    const itemWithStocks = selectedItem as Item & {
                      stocks?: Array<{ locationId: string; quantity: number }>
                    }
                    if (selectedLocId && itemWithStocks.stocks) {
                      const stock = itemWithStocks.stocks.find(
                        (s) => s.locationId === selectedLocId
                      )
                      availableStock = stock?.quantity || 0
                    }
                  }

                  return (
                    <FormItem className="min-w-0">
                      <FormLabel>Jumlah</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Masukkan jumlah"
                          {...field}
                        />
                      </FormControl>
                      {normalizedType === 'OUT' && selectedItem && (
                        <p className="text-muted-foreground text-xs">
                          Tersedia: {availableStock.toLocaleString()}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />
            )}

            {isRawMaterialIn && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <FormLabel>Drum (Opsional)</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      appendDrum({
                        label: '',
                        quantity: '' as unknown as number,
                      })
                    }
                  >
                    <Plus className="mr-2 h-5 w-5" />
                    Tambah Drum
                  </Button>
                </div>
                {drumFields.length === 0 ? (
                  <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
                    <p>Tambahkan drum untuk mencatat stok masuk per drum</p>
                    <p className="mt-1 text-xs">
                      Atau gunakan jumlah total di bawah jika tidak menggunakan
                      drum
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {drumFields.map((field, index) => (
                      <div
                        key={field.id}
                        className="flex gap-2 rounded-lg border p-3"
                      >
                        <FormField
                          control={form.control}
                          name={`drums.${index}.label`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel className="text-xs">
                                Label Drum
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Contoh: D1, D2"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`drums.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem className="w-32">
                              <FormLabel className="text-xs">Jumlah</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
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
                          className="mt-6"
                          onClick={() => removeDrum(index)}
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {drumFields.length === 0 && (
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem className="min-w-0">
                        <FormLabel>
                          Jumlah Total (jika tidak menggunakan drum)
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Masukkan jumlah"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}
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

            {/* Location selector for finished goods IN - show after date */}
            {actualItemType === 'finished-good' && normalizedType === 'IN' && (
              <FormField
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lokasi</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
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

            {/* Batch code - only for finished goods OUT */}
            {actualItemType === 'finished-good' && normalizedType === 'OUT' && (
              <FormField
                control={form.control}
                name="batchCode"
                render={({ field }) => (
                  <FormItem className="min-w-0">
                    <FormLabel>Kode Batch (Opsional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Contoh: BATCH-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
                {isLoading ? 'Mencatat...' : 'Catat'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
