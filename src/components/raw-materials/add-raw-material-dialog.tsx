'use client'

import { useState } from 'react'
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
import { Plus } from 'lucide-react'

const formSchema = z.object({
  kode: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  moq: z.coerce.number().min(1, 'MOQ must be at least 1'),
})

type FormData = z.infer<typeof formSchema>

interface AddRawMaterialDialogProps {
  onSuccess: () => void
}

export function AddRawMaterialDialog({ onSuccess }: AddRawMaterialDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      kode: '',
      name: '',
      moq: 1,
    },
  })

  async function onSubmit(data: FormData) {
    setIsLoading(true)
    try {
      const response = await fetch('/api/raw-materials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Gagal membuat bahan baku')
      }

      toast.success('Bahan baku berhasil ditambahkan')
      form.reset()
      setOpen(false)
      onSuccess()
    } catch (error) {
      console.error('Error creating raw material:', error)
      const message =
        error instanceof Error ? error.message : 'Gagal membuat bahan baku'
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
          Tambah Bahan Baku
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Tambah Bahan Baku</DialogTitle>
          <DialogDescription>
            Tambahkan bahan baku baru ke sistem inventori.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 overflow-hidden"
          >
            <FormField
              control={form.control}
              name="kode"
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel>Kode</FormLabel>
                  <FormControl>
                    <Input placeholder="Kode bahan baku" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel>Nama</FormLabel>
                  <FormControl>
                    <Input placeholder="Nama bahan baku" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="moq"
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel>MOQ (Minimum Order Quantity)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="1"
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
                {isLoading ? 'Membuat...' : 'Buat'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
