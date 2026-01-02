'use client'

import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { CalendarIcon, Plus, Trash2 } from 'lucide-react'
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
import {} from '@/components/ui/select'
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
import { Check, ChevronsUpDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getWIBDate } from '@/lib/timezone'

const createFormSchema = (rawMaterials: RawMaterial[]) =>
  z.object({
    code: z.string().min(1, 'Batch code is required'),
    date: z.date({
      required_error: 'Please select a date',
    }),
    description: z.string().optional(),
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
    materials: z
      .array(
        z.object({
          rawMaterialId: z.string().min(1, 'Please select a raw material'),
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
      .min(1, 'At least one raw material is required')
      .refine((materials) => {
        const materialIds = materials
          .map((m) => m.rawMaterialId)
          .filter((id) => id !== '')
        return materialIds.length === new Set(materialIds).size
      }, 'Cannot select the same raw material multiple times')
      .refine(
        (materials) => {
          return materials.every((material) => {
            if (!material.rawMaterialId) return true
            const rawMaterial = rawMaterials.find(
              (rm) => rm.id === material.rawMaterialId
            )
            return rawMaterial
              ? material.quantity <= rawMaterial.currentStock
              : true
          })
        },
        {
          message: 'One or more quantities exceed available stock',
          path: [],
        }
      ),
  })

type FormData = z.infer<ReturnType<typeof createFormSchema>>

interface RawMaterial {
  id: string
  name: string
  kode: string
  currentStock: number
}

interface FinishedGood {
  id: string
  name: string
  sku: string
}

interface AddBatchDialogProps {
  onSuccess: () => void
}

export function AddBatchDialog({ onSuccess }: AddBatchDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([])
  const [finishedGoods, setFinishedGoods] = useState<FinishedGood[]>([])

  const formSchema = createFormSchema(rawMaterials)
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: '',
      date: getWIBDate(),
      description: '',
      finishedGoods: [
        { finishedGoodId: '', quantity: '' as unknown as number },
      ],
      materials: [{ rawMaterialId: '', quantity: '' as unknown as number }],
    },
    mode: 'onSubmit',
  })

  // Update form validation when rawMaterials or finishedGoods change
  useEffect(() => {
    if (rawMaterials.length > 0 && finishedGoods.length > 0) {
      form.clearErrors()
    }
  }, [rawMaterials, finishedGoods, form])

  const {
    fields: materialFields,
    append: addMaterial,
    remove: removeMaterial,
  } = useFieldArray({
    control: form.control,
    name: 'materials',
  })

  const {
    fields: finishedGoodFields,
    append: addFinishedGood,
    remove: removeFinishedGood,
  } = useFieldArray({
    control: form.control,
    name: 'finishedGoods',
  })

  const fetchData = async () => {
    try {
      const [rawMaterialsRes, finishedGoodsRes] = await Promise.all([
        fetch('/api/raw-materials'),
        fetch('/api/finished-goods'),
      ])

      if (!rawMaterialsRes.ok || !finishedGoodsRes.ok) {
        throw new Error('Failed to fetch required data')
      }

      const rawMaterialsData = await rawMaterialsRes.json()
      // Handle both array response and paginated response
      const rawMats = Array.isArray(rawMaterialsData)
        ? rawMaterialsData
        : rawMaterialsData.data || []
      setRawMaterials(rawMats)

      const finishedGoodsData = await finishedGoodsRes.json()
      // Handle both array response and paginated response
      const finishedGoods = Array.isArray(finishedGoodsData)
        ? finishedGoodsData
        : finishedGoodsData.data || []
      setFinishedGoods(finishedGoods)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load required data. Please try again.')
    }
  }

  useEffect(() => {
    if (open) {
      fetchData()
    }
  }, [open])

  async function onSubmit(data: FormData) {
    setIsLoading(true)
    try {
      const response = await fetch('/api/batches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: data.code,
          date: data.date.toISOString(),
          description: data.description,
          finishedGoods: data.finishedGoods,
          materials: data.materials,
        }),
      })

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to create batch')
      }

      toast.success('Batch created successfully')
      form.reset()
      setOpen(false)
      onSuccess()
    } catch (error) {
      console.error('Error creating batch:', error)
      const message =
        error instanceof Error ? error.message : 'Failed to create batch'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Catat Pemakaian Baru
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] max-w-[95vw] flex-col sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Catat Pemakaian Baru</DialogTitle>
          <DialogDescription>
            Record a new production batch with multiple raw materials and
            finished good output.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex-1 space-y-6 overflow-y-auto pr-2"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Batch Code</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter batch code" {...field} />
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
                    <FormLabel>Date</FormLabel>
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
                              <span>Pick a date</span>
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
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Bahan Baku yang Digunakan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {materialFields.map((field, index) => (
                  <div key={field.id} className="flex items-end gap-4">
                    <FormField
                      control={form.control}
                      name={`materials.${index}.rawMaterialId`}
                      render={({ field }) => {
                        const selectedMaterial = rawMaterials.find(
                          (m) => m.id === field.value
                        )
                        const materialsWithStock = rawMaterials.filter(
                          (m) => m.currentStock > 0
                        )
                        const materialsWithoutStock = rawMaterials.filter(
                          (m) => m.currentStock === 0
                        )

                        return (
                          <FormItem className="flex flex-1 flex-col">
                            <FormLabel>Bahan Baku</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    role="combobox"
                                    className={cn(
                                      'w-full min-w-0 justify-between overflow-hidden',
                                      !field.value && 'text-muted-foreground'
                                    )}
                                  >
                                    <span className="block min-w-0 truncate text-left">
                                      {field.value && selectedMaterial
                                        ? `${selectedMaterial.kode} - ${selectedMaterial.name}`
                                        : 'Pilih bahan baku'}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-[400px] p-0"
                                align="start"
                              >
                                <Command>
                                  <CommandInput placeholder="Cari bahan baku..." />
                                  <CommandList className="max-h-[300px]">
                                    <CommandEmpty>
                                      Tidak ada bahan baku yang ditemukan.
                                    </CommandEmpty>
                                    {materialsWithStock.length > 0 && (
                                      <CommandGroup heading="Tersedia">
                                        {materialsWithStock.map((material) => (
                                          <CommandItem
                                            key={material.id}
                                            value={`${material.kode} ${material.name}`}
                                            onSelect={() => {
                                              form.setValue(
                                                `materials.${index}.rawMaterialId`,
                                                material.id
                                              )
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                'mr-2 h-4 w-4 shrink-0',
                                                material.id === field.value
                                                  ? 'opacity-100'
                                                  : 'opacity-0'
                                              )}
                                            />
                                            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                                              <span className="block truncate">
                                                {material.kode} -{' '}
                                                {material.name}
                                              </span>
                                              <span className="shrink-0 text-xs font-medium whitespace-nowrap text-green-600">
                                                (Stock:{' '}
                                                {material.currentStock.toLocaleString()}
                                                )
                                              </span>
                                            </div>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    )}
                                    {materialsWithoutStock.length > 0 && (
                                      <CommandGroup heading="Stok Habis">
                                        {materialsWithoutStock.map(
                                          (material) => (
                                            <CommandItem
                                              key={material.id}
                                              value={`${material.kode} ${material.name}`}
                                              disabled
                                            >
                                              <Check className="mr-2 h-4 w-4 shrink-0 opacity-0" />
                                              <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden opacity-50">
                                                <span className="block truncate">
                                                  {material.kode} -{' '}
                                                  {material.name}
                                                </span>
                                                <span className="text-destructive shrink-0 text-xs whitespace-nowrap">
                                                  (Out of Stock)
                                                </span>
                                              </div>
                                            </CommandItem>
                                          )
                                        )}
                                      </CommandGroup>
                                    )}
                                    {materialsWithStock.length === 0 &&
                                      materialsWithoutStock.length === 0 && (
                                        <div className="text-muted-foreground px-2 py-6 text-center text-sm">
                                          Tidak ada bahan baku tersedia
                                        </div>
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
                    <FormField
                      control={form.control}
                      name={`materials.${index}.quantity`}
                      render={({ field }) => {
                        const selectedMaterialId = form.watch(
                          `materials.${index}.rawMaterialId`
                        )
                        const selectedMaterial = rawMaterials.find(
                          (m) => m.id === selectedMaterialId
                        )
                        const availableStock =
                          selectedMaterial?.currentStock || 0

                        return (
                          <FormItem className="w-40">
                            <FormLabel>Quantity</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0"
                                {...field}
                              />
                            </FormControl>
                            {selectedMaterial && (
                              <p className="text-muted-foreground text-xs">
                                Available: {availableStock.toLocaleString()}
                              </p>
                            )}
                            <FormMessage />
                          </FormItem>
                        )
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeMaterial(index)}
                      disabled={materialFields.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Material
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Produk Jadi yang Dihasilkan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {finishedGoodFields.map((field, index) => (
                  <div key={field.id} className="flex items-end gap-4">
                    <FormField
                      control={form.control}
                      name={`finishedGoods.${index}.finishedGoodId`}
                      render={({ field: finishedGoodField }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Produk Jadi</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn(
                                    'w-full justify-between',
                                    !finishedGoodField.value &&
                                      'text-muted-foreground'
                                  )}
                                >
                                  {finishedGoodField.value
                                    ? finishedGoods.find(
                                        (fg) =>
                                          fg.id === finishedGoodField.value
                                      )?.name
                                    : 'Pilih produk jadi'}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                              <Command>
                                <CommandInput placeholder="Cari produk jadi..." />
                                <CommandEmpty>
                                  Tidak ada produk jadi ditemukan.
                                </CommandEmpty>
                                <CommandList>
                                  <CommandGroup>
                                    {finishedGoods.map((fg) => (
                                      <CommandItem
                                        value={fg.name}
                                        key={fg.id}
                                        onSelect={() => {
                                          form.setValue(
                                            `finishedGoods.${index}.finishedGoodId`,
                                            fg.id
                                          )
                                          form.trigger(
                                            `finishedGoods.${index}.finishedGoodId`
                                          )
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            'mr-2 h-4 w-4',
                                            fg.id === finishedGoodField.value
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
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`finishedGoods.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem className="w-40">
                          <FormLabel>Quantity</FormLabel>
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
                      variant="outline"
                      size="sm"
                      onClick={() => removeFinishedGood(index)}
                      disabled={finishedGoodFields.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    addFinishedGood({
                      finishedGoodId: '',
                      quantity: '' as unknown as number,
                    })
                  }
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah Produk Jadi
                </Button>
              </CardContent>
            </Card>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Creating...' : 'Create Batch'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
