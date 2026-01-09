'use client'

import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
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
import { ItemSelector } from '@/components/forms'
import { useFormSubmission } from '@/lib/hooks'
import type { FinishedGood } from '@/lib/types'
import { Plus, Trash2 } from 'lucide-react'

const formSchema = z.object({
  finishedGoods: z
    .array(
      z.object({
        finishedGoodId: z.string().min(1, 'Silakan pilih produk jadi'),
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
    .min(1, 'Minimal satu produk jadi wajib dipilih')
    .refine((finishedGoods) => {
      const finishedGoodIds = finishedGoods
        .map((fg) => fg.finishedGoodId)
        .filter((id) => id !== '')
      return finishedGoodIds.length === new Set(finishedGoodIds).size
    }, 'Tidak dapat memilih produk jadi yang sama lebih dari sekali'),
})

type FormData = z.infer<typeof formSchema>

interface AddFinishedGoodsDialogProps {
  batchId: string
  batchCode: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AddFinishedGoodsDialog({
  batchId,
  batchCode,
  open,
  onOpenChange,
  onSuccess,
}: AddFinishedGoodsDialogProps) {
  const [finishedGoods, setFinishedGoods] = useState<FinishedGood[]>([])

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      finishedGoods: [
        { finishedGoodId: '', quantity: '' as unknown as number },
      ],
    },
    mode: 'onSubmit',
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'finishedGoods',
  })

  useEffect(() => {
    if (open) {
      const fetchFinishedGoods = async () => {
        try {
          const response = await fetch('/api/finished-goods')
          if (!response.ok) {
            throw new Error('Failed to fetch finished goods')
          }
          const data = await response.json()
          const goods = Array.isArray(data) ? data : data.data || []
          setFinishedGoods(goods)
        } catch (_error) {
          toast.error('Failed to load finished goods')
        }
      }
      fetchFinishedGoods()
    }
  }, [open])

  const { handleSubmit: handleFormSubmit, isLoading } = useFormSubmission({
    onSubmit: async (data: FormData) => {
      const response = await fetch(`/api/batches/${batchId}/finished-goods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finishedGoods: data.finishedGoods,
        }),
      })

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to add finished goods')
      }

      toast.success('Finished goods added successfully')
      form.reset({
        finishedGoods: [
          { finishedGoodId: '', quantity: '' as unknown as number },
        ],
      })
      onOpenChange(false)
      onSuccess()
    },
    successMessage: undefined, // Custom message handled in onSubmit
    errorMessage: 'Failed to add finished goods',
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Tambah Produk Jadi ke Batch</DialogTitle>
          <DialogDescription>
            Tambahkan produk jadi yang dihasilkan dari batch {batchCode}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleFormSubmit)}
            className="space-y-4"
          >
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-4">
                <FormField
                  control={form.control}
                  name={`finishedGoods.${index}.finishedGoodId`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Produk Jadi</FormLabel>
                      <FormControl>
                        <ItemSelector
                          items={finishedGoods}
                          itemType="finished-good"
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="Pilih produk jadi"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`finishedGoods.${index}.quantity`}
                  render={({ field }) => (
                    <FormItem className="w-32">
                      <FormLabel>Jumlah</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Qty"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                append({
                  finishedGoodId: '',
                  quantity: '' as unknown as number,
                })
              }
              className="w-full"
            >
              <Plus className="mr-2 h-5 w-5" />
              Tambah Produk Jadi Lainnya
            </Button>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Menambahkan...' : 'Tambah Produk Jadi'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
