"use client"

import { useEffect, useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { CalendarIcon, Trash2, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { Batch, BatchUsage, RawMaterial, FinishedGood } from "@prisma/client"

type BatchWithUsage = Batch & {
  finishedGood?: FinishedGood | null
  batchUsages: (BatchUsage & {
    rawMaterial: RawMaterial
  })[]
}

const formSchema = z.object({
  code: z.string().min(1, "Batch code is required"),
  date: z.date({
    required_error: "Please select a date",
  }),
  description: z.string().optional(),
  finishedGoodId: z.string().min(1, "Please select a finished good"),
  materials: z.array(
    z.object({
      rawMaterialId: z.string().min(1, "Please select a raw material"),
      quantity: z.coerce.number().positive("Quantity must be greater than 0"),
    })
  ).min(1, "At least one raw material is required"),
})

type FormData = z.infer<typeof formSchema>

interface EditBatchDialogProps {
  batch: BatchWithUsage | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditBatchDialog({
  batch,
  open,
  onOpenChange,
  onSuccess,
}: EditBatchDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [finishedGoods, setFinishedGoods] = useState<FinishedGood[]>([])
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([])

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      date: new Date(),
      description: "",
      finishedGoodId: "",
      materials: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "materials",
  })

  const fetchFinishedGoods = async () => {
    try {
      const response = await fetch("/api/finished-goods")
      if (!response.ok) {
        throw new Error("Failed to fetch finished goods")
      }
      const json = await response.json()
      // API returns { success: true, data: [...] }
      const data = json.data || json
      setFinishedGoods(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching finished goods:", error)
      toast.error("Failed to load finished goods")
    }
  }

  const fetchRawMaterials = async () => {
    try {
      const response = await fetch("/api/raw-materials")
      if (!response.ok) {
        throw new Error("Failed to fetch raw materials")
      }
      const json = await response.json()
      const data = json.data || json
      setRawMaterials(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching raw materials:", error)
      toast.error("Failed to load raw materials")
    }
  }

  useEffect(() => {
    if (open) {
      fetchFinishedGoods()
      fetchRawMaterials()
    }
  }, [open])

  useEffect(() => {
    if (batch) {
      form.reset({
        code: batch.code,
        date: new Date(batch.date),
        description: batch.description || "",
        finishedGoodId: batch.finishedGoodId,
        materials: batch.batchUsages.map(usage => ({
          rawMaterialId: usage.rawMaterialId,
          quantity: usage.quantity,
        })),
      })
    }
  }, [batch, form])

  async function onSubmit(data: FormData) {
    if (!batch) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/batches/${batch.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          date: data.date.toISOString(),
          materials: data.materials,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || "Failed to update batch")
      }

      toast.success("Batch updated successfully with material changes")
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error("Error updating batch:", error)
      const message = error instanceof Error ? error.message : "Failed to update batch"
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Batch</DialogTitle>
          <DialogDescription>
            Update batch information and raw materials usage. (ADMIN only)
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
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
                            date > new Date() || date < new Date("1900-01-01")
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

            <FormField
              control={form.control}
              name="finishedGoodId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Finished Good</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select finished good" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {finishedGoods.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Raw Materials Used</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-2 items-start">
                    <FormField
                      control={form.control}
                      name={`materials.${index}.rawMaterialId`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Raw Material</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full [&>span]:truncate">
                                <SelectValue placeholder="Select raw material" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {rawMaterials.filter((m) => m.currentStock > 0)
                                .length === 0 ? (
                                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                  No raw materials with stock available
                                </div>
                              ) : (
                                <>
                                  {rawMaterials
                                    .filter((m) => m.currentStock > 0)
                                    .map((material) => (
                                      <SelectItem
                                        key={material.id}
                                        value={material.id}
                                      >
                                        <div className="flex items-center gap-2 max-w-[400px]">
                                          <span className="truncate">
                                            {material.kode} - {material.name}
                                          </span>
                                          <span className="text-green-600 font-medium whitespace-nowrap shrink-0">
                                            (Stock: {material.currentStock.toLocaleString()})
                                          </span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  {rawMaterials.filter(
                                    (m) => m.currentStock === 0
                                  ).length > 0 && (
                                    <>
                                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground border-t">
                                        Out of Stock
                                      </div>
                                      {rawMaterials
                                        .filter((m) => m.currentStock === 0)
                                        .map((material) => (
                                          <SelectItem
                                            key={material.id}
                                            value={material.id}
                                            disabled
                                          >
                                            <div className="flex items-center gap-2 max-w-[400px]">
                                              <span className="truncate">
                                                {material.kode} - {material.name}
                                              </span>
                                              <span className="text-destructive whitespace-nowrap shrink-0">
                                                (Out of Stock)
                                              </span>
                                            </div>
                                          </SelectItem>
                                        ))}
                                    </>
                                  )}
                                </>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`materials.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem className="w-32">
                          <FormLabel>Quantity</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
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
                      className="mt-8"
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
                  size="sm"
                  className="w-full"
                  onClick={() => append({ rawMaterialId: "", quantity: 0 })}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Material
                </Button>
              </CardContent>
            </Card>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Updating..." : "Update"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
