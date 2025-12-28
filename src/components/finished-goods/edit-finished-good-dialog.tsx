"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
import { FinishedGood } from "@prisma/client"

const formSchema = z.object({
  name: z.string().min(1, "Nama produk harus diisi"),
})

type FormData = z.infer<typeof formSchema>

interface EditFinishedGoodDialogProps {
  product: FinishedGood | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditFinishedGoodDialog({
  product,
  open,
  onOpenChange,
  onSuccess,
}: EditFinishedGoodDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
    },
  })

  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
      })
    }
  }, [product, form])

  async function onSubmit(data: FormData) {
    if (!product) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/finished-goods/${product.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || "Failed to update finished good")
      }

      toast.success("Produk jadi berhasil diperbarui")
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error("Error updating finished good:", error)
      const message = error instanceof Error ? error.message : "Gagal memperbarui produk jadi"
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-w-[95vw]">
        <DialogHeader>
          <DialogTitle>Edit Produk Jadi</DialogTitle>
          <DialogDescription>
            Perbarui informasi produk jadi.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 overflow-hidden">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel>Nama Produk</FormLabel>
                  <FormControl>
                    <Input placeholder="Masukkan nama produk" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Memperbarui..." : "Perbarui"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
