'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, TrendingUp } from 'lucide-react'
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
import { ItemSelector, DatePickerField } from '@/components/forms'
import { drumStockInSchema, DrumStockInForm } from '@/lib/validations'

interface DrumStockEntryDialogProps {
  onSuccess: () => void
  children?: React.ReactNode
}

export function DrumStockEntryDialog({
  onSuccess,
  children,
}: DrumStockEntryDialogProps) {
  const [open, setOpen] = useState(false)
  const [rawMaterials, setRawMaterials] = useState<any[]>([])

  const fetchRawMaterials = async () => {
      try {
          const response = await fetch('/api/raw-materials')
          if (!response.ok) throw new Error('Failed to fetch raw materials')
          const data = await response.json()
          setRawMaterials(Array.isArray(data) ? data : data.data || [])
      } catch (_err) {
          toast.error('Gagal memuat bahan baku')
      }
  }

  // Fetch when dialog opens
  if (open && rawMaterials.length === 0) {
      fetchRawMaterials()
  }

  const form = useForm<DrumStockInForm>({
    resolver: zodResolver(drumStockInSchema),
    defaultValues: {
        rawMaterialId: '',
        date: new Date(),
        description: '',
        drums: [{ label: '', quantity: 0 }]
    }
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'drums'
  })

  const onSubmit = async (data: DrumStockInForm) => {
    try {
        const response = await fetch('/api/stock-movements/drum-in', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...data,
                date: data.date.toISOString() // Serialize date
            })
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to create stock entry')
        }

        toast.success('Stok masuk (Drum) berhasil dicatat')
        setOpen(false)
        form.reset()
        onSuccess()
    } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unknown error')
    }
  }

  const totalQuantity = form.watch('drums').reduce((sum, d) => sum + (Number(d.quantity) || 0), 0)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline">
            <TrendingUp className="mr-2 h-4 w-4" />
            Input Stok Masuk (Drum)
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Input Stok Masuk (Drum)</DialogTitle>
          <DialogDescription>
            Catat penerimaan bahan baku dalam satuan Drum.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="rawMaterialId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bahan Baku</FormLabel>
                   <FormControl>
                    <ItemSelector
                      items={rawMaterials}
                      itemType="raw-material"
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Pilih bahan baku"
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
                <FormItem>
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
                  <FormLabel>Deskripsi (Opsional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Contoh: Penerimaan Supplier A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2 border rounded p-3">
                <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold text-sm">Daftar Drum</h4>
                    <Button type="button" size="sm" variant="secondary" onClick={() => append({ label: '', quantity: 0 })}>
                        <Plus className="h-4 w-4 mr-1" /> Tambah Drum
                    </Button>
                </div>
                
                {fields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 items-start">
                         <FormField
                            control={form.control}
                            name={`drums.${index}.label`}
                            render={({ field }) => (
                                <FormItem className="flex-1">
                                    <FormControl>
                                        <Input placeholder="Label / Kode Drum" {...field} />
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
                                    <FormControl>
                                        <Input type="number" placeholder="Qty" step="0.01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
                
                <div className="text-right text-sm font-medium mt-2">
                    Total: {totalQuantity.toLocaleString()}
                </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  'Simpan'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
