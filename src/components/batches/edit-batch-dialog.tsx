"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      date: new Date(),
      description: "",
      finishedGoodId: "",
    },
  })

  const fetchFinishedGoods = async () => {
    try {
      const response = await fetch("/api/finished-goods")
      if (!response.ok) {
        throw new Error("Failed to fetch finished goods")
      }
      const data = await response.json()
      setFinishedGoods(data)
    } catch (error) {
      console.error("Error fetching finished goods:", error)
      toast.error("Failed to load finished goods")
    }
  }

  useEffect(() => {
    if (open) {
      fetchFinishedGoods()
    }
  }, [open])

  useEffect(() => {
    if (batch) {
      form.reset({
        code: batch.code,
        date: new Date(batch.date),
        description: batch.description || "",
        finishedGoodId: batch.finishedGoodId,
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
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || "Failed to update batch")
      }

      toast.success("Batch updated successfully")
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Batch</DialogTitle>
          <DialogDescription>
            Update batch information. Note: Raw materials cannot be modified after creation.
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

            {batch && (
              <div className="bg-muted p-3 rounded-md">
                <p className="text-sm font-medium mb-2">Raw Materials (Read-only)</p>
                <ul className="text-sm space-y-1">
                  {batch.batchUsages.map((usage, idx) => (
                    <li key={idx} className="text-muted-foreground">
                      {usage.rawMaterial.kode} - {usage.quantity.toLocaleString()} units
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
