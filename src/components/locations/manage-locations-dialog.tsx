
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
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Pencil, Trash2, Plus, Loader2 } from 'lucide-react'

// Define locally to avoid CI issues if Prisma client isn't perfectly synced
interface Location {
  id: string
  name: string
  address: string | null
  isDefault: boolean
}

const locationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().optional(),
  isDefault: z.boolean().default(false),
})

type LocationFormValues = z.infer<typeof locationSchema>

interface ManageLocationsDialogProps {
  trigger?: React.ReactNode
  onLocationsChange?: () => void
}

export function ManageLocationsDialog({ trigger, onLocationsChange }: ManageLocationsDialogProps) {
  const [open, setOpen] = useState(false)
  const [locations, setLocations] = useState<Location[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema) as any,
    defaultValues: {
      name: '',
      address: '',
      isDefault: false,
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
      toast.error('Failed to load locations')
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

      toast.success(editingId ? 'Location updated' : 'Location created')
      fetchLocations()
      if (onLocationsChange) onLocationsChange()
      
      // Reset form
      setEditingId(null)
      form.reset({ name: '', address: '', isDefault: false })
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
      address: location.address || '',
      isDefault: location.isDefault,
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? This cannot be undone if stock exists.')) return

    try {
      const res = await fetch(`/api/locations/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const result = await res.json()
        throw new Error(result.error || 'Failed to delete')
      }

      toast.success('Location deleted')
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
      form.reset({ name: '', address: '', isDefault: false })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">Manage Locations</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Locations</DialogTitle>
          <DialogDescription>
            Add or edit finished goods storage locations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Form */}
          <div className="bg-muted/50 p-4 rounded-lg">
             <h3 className="font-semibold mb-3">{editingId ? 'Edit Location' : 'Add New Location'}</h3>
             <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Location Name</FormLabel>
                        <FormControl>
                        <Input placeholder="e.g. Jakarta" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Address (Optional)</FormLabel>
                        <FormControl>
                        <Input placeholder="Address" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </div>
              <FormField
                control={form.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Set as Default Location
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={form.formState.isSubmitting}>
                   {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                   {editingId ? 'Update Location' : 'Add Location'}
                </Button>
                {editingId && (
                    <Button type="button" variant="ghost" onClick={handleCancelEdit}>Cancel</Button>
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
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center h-24">Loading...</TableCell>
                    </TableRow>
                ) : locations.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">No locations found.</TableCell>
                    </TableRow>
                ) : (
                    locations.map((loc) => (
                    <TableRow key={loc.id}>
                        <TableCell className="font-medium">{loc.name}</TableCell>
                        <TableCell>{loc.address || '-'}</TableCell>
                        <TableCell>{loc.isDefault && <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">Default</span>}</TableCell>
                        <TableCell className="text-right space-x-2">
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(loc)}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(loc.id)}>
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
