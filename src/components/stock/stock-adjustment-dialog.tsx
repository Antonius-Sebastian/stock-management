'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { CalendarIcon, Check, ChevronsUpDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { getWIBDate } from '@/lib/timezone'

const createFormSchema = (items: Item[]) =>
  z
    .object({
      itemId: z.string().min(1, 'Please select an item'),
      quantity: z.coerce
        .number({
          required_error: 'Quantity is required',
          invalid_type_error: 'Quantity must be a number',
        })
        .refine((val) => !isNaN(val) && val !== 0, 'Quantity cannot be zero'),
      date: z.date({
        required_error: 'Please select a date',
      }),
      description: z.string().min(1, 'Reason is required for stock adjustment'),
    })
    .refine(
      (data) => {
        const selectedItem = items.find((item) => item.id === data.itemId)
        if (selectedItem && 'currentStock' in selectedItem) {
          const currentStock = (selectedItem as Item & { currentStock: number })
            .currentStock
          const newStock = currentStock + data.quantity
          return newStock >= 0
        }
        return true
      },
      {
        message: 'Adjustment would result in negative stock',
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

interface Item {
  id: string
  name: string
  kode?: string
  sku?: string
  currentStock?: number
}

type FormData = z.infer<ReturnType<typeof createFormSchema>>

export function StockAdjustmentDialog({
  itemType,
  entityType,
  entityId,
  entityName,
  onSuccess,
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: StockAdjustmentDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [items, setItems] = useState<Item[]>([])

  // Use controlled or uncontrolled state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen =
    controlledOnOpenChange !== undefined
      ? controlledOnOpenChange
      : setInternalOpen

  // Determine the actual item type to use
  const actualItemType = entityType || itemType || 'raw-material'

  const formSchema = createFormSchema(items)
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      itemId: entityId || '',
      quantity: '' as unknown as number,
      date: getWIBDate(),
      description: '',
    },
    mode: 'onSubmit',
  })

  const fetchItems = async (signal: AbortSignal) => {
    try {
      const endpoint =
        actualItemType === 'raw-material'
          ? '/api/raw-materials'
          : '/api/finished-goods'
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

  async function onSubmit(data: FormData) {
    setIsLoading(true)
    try {
      const stockMovementData = {
        type: 'ADJUSTMENT',
        quantity: data.quantity,
        date: data.date.toISOString(),
        description: data.description || 'Stock adjustment',
        ...(actualItemType === 'raw-material'
          ? { rawMaterialId: data.itemId }
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
      })
      setOpen(false)
      onSuccess()
    } catch (error) {
      console.error('Error adjusting stock:', error)
      const message =
        error instanceof Error ? error.message : 'Failed to adjust stock'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="itemId"
              render={({ field }) => {
                const itemsWithStock = items.filter(
                  (item) =>
                    !('currentStock' in item) ||
                    (item as Item & { currentStock: number }).currentStock >= 0
                )

                return (
                  <FormItem className="flex flex-col">
                    <FormLabel>
                      {actualItemType === 'raw-material'
                        ? 'Bahan Baku'
                        : 'Produk Jadi'}
                    </FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              'w-full min-w-0 justify-between overflow-hidden',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            <span className="block min-w-0 truncate text-left">
                              {field.value
                                ? actualItemType === 'raw-material'
                                  ? `${selectedItem?.kode} - ${selectedItem?.name}`
                                  : selectedItem?.name
                                : `Pilih ${
                                    actualItemType === 'raw-material'
                                      ? 'bahan baku'
                                      : 'produk jadi'
                                  }`}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput
                            placeholder={`Cari ${
                              actualItemType === 'raw-material'
                                ? 'bahan baku'
                                : 'produk jadi'
                            }...`}
                          />
                          <CommandList className="max-h-[300px]">
                            <CommandEmpty>
                              Tidak ada item yang ditemukan.
                            </CommandEmpty>
                            {itemsWithStock.length > 0 && (
                              <CommandGroup>
                                {itemsWithStock.map((item) => (
                                  <CommandItem
                                    key={item.id}
                                    value={
                                      actualItemType === 'raw-material'
                                        ? `${item.kode} ${item.name}`
                                        : item.name
                                    }
                                    onSelect={() => {
                                      form.setValue('itemId', item.id)
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        'mr-2 h-4 w-4 shrink-0',
                                        item.id === field.value
                                          ? 'opacity-100'
                                          : 'opacity-0'
                                      )}
                                    />
                                    <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                                      <span className="block truncate">
                                        {actualItemType === 'raw-material'
                                          ? `${item.kode} - ${item.name}`
                                          : item.name}
                                      </span>
                                      {'currentStock' in item && (
                                        <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
                                          (Stock:{' '}
                                          {(
                                            item as Item & {
                                              currentStock: number
                                            }
                                          ).currentStock.toLocaleString()}
                                          )
                                        </span>
                                      )}
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />

            {currentStock !== null && (
              <div className="text-muted-foreground text-sm">
                Stok Saat Ini:{' '}
                <span className="font-medium">
                  {currentStock.toLocaleString()}
                </span>
              </div>
            )}

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jumlah Penyesuaian</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Masukkan nilai positif atau negatif"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-muted-foreground text-xs">
                    Nilai positif menambah stok, nilai negatif mengurangi stok
                  </p>
                  {currentStock !== null && form.watch('quantity') && (
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
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Tanggal</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={'outline'}
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'PPP')
                          ) : (
                            <span>Pilih tanggal</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date('1900-01-01')
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
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
