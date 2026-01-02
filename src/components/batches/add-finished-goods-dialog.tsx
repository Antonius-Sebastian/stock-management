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
import { Check, ChevronsUpDown, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { addFinishedGoodsSchema } from '@/lib/validations'

const formSchema = z.object({
  finishedGoods: z
    .array(
      z.object({
        finishedGoodId: z.string().min(1, 'Please select a finished good'),
        quantity: z.coerce
          .number({
            required_error: 'Quantity is required',
            invalid_type_error: 'Quantity must be a number',
          })
          .refine(
            (val) => !isNaN(val) && val > 0,
            'Quantity must be greater than zero'
          ),
      })
    )
    .min(1, 'At least one finished good is required')
    .refine((finishedGoods) => {
      const finishedGoodIds = finishedGoods
        .map((fg) => fg.finishedGoodId)
        .filter((id) => id !== '')
      return finishedGoodIds.length === new Set(finishedGoodIds).size
    }, 'Cannot select the same finished good multiple times'),
})

type FormData = z.infer<typeof formSchema>

interface FinishedGood {
  id: string
  name: string
}

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
  const [isLoading, setIsLoading] = useState(false)
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

  const {
    fields,
    append,
    remove,
  } = useFieldArray({
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
        } catch (error) {
          toast.error('Failed to load finished goods')
        }
      }
      fetchFinishedGoods()
    }
  }, [open])

  async function onSubmit(data: FormData) {
    setIsLoading(true)
    try {
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
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to add finished goods'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

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
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-4">
                <FormField
                  control={form.control}
                  name={`finishedGoods.${index}.finishedGoodId`}
                  render={({ field }) => {
                    const selectedFinishedGood = finishedGoods.find(
                      (fg) => fg.id === field.value
                    )

                    return (
                      <FormItem className="flex-1">
                        <FormLabel>Produk Jadi</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                type="button"
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  'w-full justify-between',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                <span className="block min-w-0 truncate text-left">
                                  {field.value && selectedFinishedGood
                                    ? selectedFinishedGood.name
                                    : 'Pilih produk jadi'}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0">
                            <Command>
                              <CommandInput placeholder="Cari produk jadi..." />
                              <CommandList>
                                <CommandEmpty>
                                  Tidak ada produk jadi yang ditemukan.
                                </CommandEmpty>
                                <CommandGroup>
                                  {finishedGoods.map((fg) => (
                                    <CommandItem
                                      key={fg.id}
                                      value={fg.name}
                                      onSelect={() => {
                                        form.setValue(
                                          `finishedGoods.${index}.finishedGoodId`,
                                          fg.id
                                        )
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          'mr-2 h-4 w-4 shrink-0',
                                          fg.id === field.value
                                            ? 'opacity-100'
                                            : 'opacity-0'
                                        )}
                                      />
                                      {fg.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )
                  }}
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
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                append({ finishedGoodId: '', quantity: '' as unknown as number })
              }
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
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

