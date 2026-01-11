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
import { Loader2 } from 'lucide-react'

interface Location {
  id: string
  name: string
  isDefault: boolean
}

const createFormSchema = (itemType: 'raw-material' | 'finished-good') =>
  z.object({
    quantity: z.coerce
      .number({
        required_error: 'Jumlah wajib diisi',
        invalid_type_error: 'Jumlah harus berupa angka',
      })
      .refine((val) => !isNaN(val) && val > 0, 'Jumlah harus lebih besar dari nol')
      .refine((val) => val <= 1000000, 'Jumlah tidak boleh melebihi 1,000,000'),
    date: z.date({
      required_error: 'Silakan pilih tanggal',
    }),
    description: z.string().nullable().optional(),
    locationId: z.string().optional().nullable(),
  })

interface Movement {
  id: string
  type: 'IN' | 'OUT' | 'ADJUSTMENT'
  quantity: number
  date: string | Date
  description: string | null
  locationId?: string | null
}

interface EditMovementDialogProps {
  movement: Movement
  itemType: 'raw-material' | 'finished-good'
  onSuccess: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

type FormData = z.infer<ReturnType<typeof createFormSchema>>

export function EditMovementDialog({
  movement,
  itemType,
  onSuccess,
  open,
  onOpenChange,
}: EditMovementDialogProps) {
  const [locations, setLocations] = useState<Location[]>([])
  const [isLoadingLocations, setIsLoadingLocations] = useState(false)

  const formSchema = createFormSchema(itemType)
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: movement.quantity,
      date: new Date(movement.date),
      description: movement.description || null,
      locationId: movement.locationId || null,
    },
    mode: 'onSubmit',
  })

  // Fetch locations for finished goods
  useEffect(() => {
    if (open && itemType === 'finished-good') {
      setIsLoadingLocations(true)
      fetch('/api/locations')
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch locations')
          return res.json()
        })
        .then((data) => {
          setLocations(data)
          // If no locationId set and movement has locationId, set it
          if (movement.locationId && !form.getValues('locationId')) {
            form.setValue('locationId', movement.locationId)
          }
        })
        .catch((error) => {
          console.error('Failed to fetch locations', error)
          toast.error('Gagal memuat lokasi. Silakan coba lagi.')
        })
        .finally(() => {
          setIsLoadingLocations(false)
        })
    }
  }, [open, itemType, movement.locationId, form])

  // Reset form when movement changes
  useEffect(() => {
    if (open && movement) {
      form.reset({
        quantity: movement.quantity,
        date: new Date(movement.date),
        description: movement.description || null,
        locationId: movement.locationId || null,
      })
    }
  }, [open, movement, form])

  const handleSubmit = async (data: FormData) => {
    try {
      const updateData: {
        quantity?: number
        date?: string
        description?: string | null
        locationId?: string | null
      } = {}

      // Only include fields that changed
      if (data.quantity !== movement.quantity) {
        updateData.quantity = data.quantity
      }
      if (data.date.getTime() !== new Date(movement.date).getTime()) {
        updateData.date = data.date.toISOString()
      }
      if (data.description !== movement.description) {
        updateData.description = data.description
      }
      if (data.locationId !== movement.locationId) {
        updateData.locationId = data.locationId
      }

      // Check if anything changed
      if (Object.keys(updateData).length === 0) {
        toast.info('Tidak ada perubahan yang perlu disimpan')
        onOpenChange(false)
        return
      }

      const response = await fetch(`/api/stock-movements/${movement.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to update stock movement')
      }

      toast.success('Berhasil memperbarui pergerakan stok')
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message || 'Gagal memperbarui pergerakan stok')
      } else {
        toast.error('Gagal memperbarui pergerakan stok')
      }
    }
  }

  const isSubmitting = form.formState.isSubmitting

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Pergerakan Stok</DialogTitle>
          <DialogDescription>
            Perbarui informasi pergerakan stok. Hanya field yang diubah akan
            diperbarui.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jumlah</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Masukkan jumlah"
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      disabled={isSubmitting}
                    />
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
                  <FormLabel>Deskripsi (Opsional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Masukkan deskripsi"
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Location selection for finished goods */}
            {itemType === 'finished-good' && (
              <FormField
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lokasi</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                        disabled={isSubmitting || isLoadingLocations}
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Pilih lokasi" />
                        </SelectTrigger>
                        <SelectContent>
                          {isLoadingLocations ? (
                            <div className="text-muted-foreground py-2 text-center text-sm">
                              Memuat lokasi...
                            </div>
                          ) : locations.length === 0 ? (
                            <div className="text-muted-foreground py-2 text-center text-sm">
                              Tidak ada lokasi tersedia
                            </div>
                          ) : (
                            <>
                              <SelectItem value="">Tidak ada lokasi</SelectItem>
                              {locations.map((loc) => (
                                <SelectItem key={loc.id} value={loc.id}>
                                  {loc.name}
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

