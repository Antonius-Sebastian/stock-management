'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Pencil, Trash2, Plus, Loader2 } from 'lucide-react'

// Define locally to avoid CI issues if Prisma client isn't perfectly synced
interface Location {
  id: string
  name: string
  address?: string | null
  isDefault?: boolean
}

const locationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
})

type LocationFormValues = z.infer<typeof locationSchema>

interface ManageLocationsDialogProps {
  trigger?: React.ReactNode
  onLocationsChange?: () => void
}

export function ManageLocationsDialog({
  trigger,
  onLocationsChange,
}: ManageLocationsDialogProps) {
  const [open, setOpen] = useState(false)
  const [locations, setLocations] = useState<Location[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema) as any,
    defaultValues: {
      name: '',
    } as LocationFormValues, // Explicit cast to satisfy strict types check
  })

  const fetchLocations = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/locations')
      if (!res.ok) throw new Error('Failed to fetch locations')
      const data = await res.json()
      setLocations(data)
    } catch (error) {
      toast.error('Gagal memuat lokasi')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchLocations()
    } else {
      setEditingId(null)
      form.reset()
    }
  }, [open])

  const onSubmit = async (data: LocationFormValues) => {
    try {
      const url = editingId ? `/api/locations/${editingId}` : '/api/locations'
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await res.json()

      if (!res.ok) throw new Error(result.error || 'Failed to save location')

      toast.success(
        editingId ? 'Lokasi berhasil diperbarui' : 'Lokasi berhasil dibuat'
      )
      fetchLocations()
      if (onLocationsChange) onLocationsChange()

      // Reset form
      setEditingId(null)
      form.reset({ name: '' })
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error('An unknown error occurred')
      }
    }
  }

  const handleEdit = (location: Location) => {
    setEditingId(location.id)
    form.reset({
      name: location.name,
    })
  }

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        'Apakah Anda yakin? Tindakan ini tidak dapat dibatalkan jika ada stok.'
      )
    )
      return

    try {
      const res = await fetch(`/api/locations/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const result = await res.json()
        throw new Error(result.error || 'Failed to delete')
      }

      toast.success('Lokasi berhasil dihapus')
      fetchLocations()
      if (onLocationsChange) onLocationsChange()
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message)
      }
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    form.reset({ name: '' })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">Kelola Lokasi</Button>}
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kelola Lokasi</DialogTitle>
          <DialogDescription>
            Tambah atau edit lokasi penyimpanan produk jadi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Form */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="mb-3 font-semibold">
              {editingId ? 'Edit Lokasi' : 'Tambah Lokasi Baru'}
            </h3>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nama Lokasi</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Jakarta" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2">
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {editingId ? 'Perbarui Lokasi' : 'Tambah Lokasi'}
                  </Button>
                  {editingId && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleCancelEdit}
                    >
                      Batal
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </div>

          {/* List */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={2} className="h-24 text-center">
                      Memuat...
                    </TableCell>
                  </TableRow>
                ) : locations.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="text-muted-foreground h-24 text-center"
                    >
                      Tidak ada lokasi ditemukan.
                    </TableCell>
                  </TableRow>
                ) : (
                  locations.map((loc) => (
                    <TableRow key={loc.id}>
                      <TableCell className="font-medium">{loc.name}</TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(loc)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(loc.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
