'use client'

import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

type AddUserDialogProps = {
  children: React.ReactNode
  onSuccess: () => void
}

export function AddUserDialog({ children, onSuccess }: AddUserDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    name: '',
    role: 'OFFICE_PURCHASING' as 'ADMIN' | 'OFFICE_PURCHASING' | 'OFFICE_WAREHOUSE',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email || null,
          password: formData.password,
          name: formData.name,
          role: formData.role,
        }),
      })

      if (response.ok) {
        toast.success(`User "${formData.username}" created successfully`)
        setOpen(false)
        setFormData({
          username: '',
          email: '',
          password: '',
          name: '',
          role: 'OFFICE_PURCHASING',
        })
        onSuccess()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to create user')
      }
    } catch {
      toast.error('Failed to create user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-[425px]">
        <form onSubmit={handleSubmit} className="overflow-hidden">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account. Default password can be changed after
              login.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="username">
                Username <span className="text-red-500">*</span>
              </Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                placeholder="johndoe"
                required
                minLength={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="John Doe"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email (Optional)</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="john@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">
                Password <span className="text-red-500">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="Min. 6 characters"
                required
                minLength={6}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">
                Role <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.role}
                onValueChange={(value: 'ADMIN' | 'OFFICE_PURCHASING' | 'OFFICE_WAREHOUSE') =>
                  setFormData({ ...formData, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">
                    <div className="flex items-center gap-2">
                      <span>Admin</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <p className="font-semibold">Akses Penuh</p>
                            <p className="text-xs mt-1">Dapat mengakses semua fitur sistem</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </SelectItem>
                  <SelectItem value="OFFICE_PURCHASING">
                    <div className="flex items-center gap-2">
                      <span>Office Purchasing</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <p className="font-semibold">Pembelian & Penjualan</p>
                            <p className="text-xs mt-1">• Stok Masuk Bahan Baku</p>
                            <p className="text-xs">• Stok Keluar Produk Jadi</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </SelectItem>
                  <SelectItem value="OFFICE_WAREHOUSE">
                    <div className="flex items-center gap-2">
                      <span>Office Warehouse</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <p className="font-semibold">Gudang & Produksi</p>
                            <p className="text-xs mt-1">• Stok Masuk Produk Jadi</p>
                            <p className="text-xs">• Stok Keluar Bahan Baku</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
