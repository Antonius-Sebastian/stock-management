'use client'

import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import type { User } from '@/app/users/page'

type EditUserDialogProps = {
  user: User
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditUserDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: EditUserDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    username: user.username,
    email: user.email || '',
    password: '',
    name: user.name,
    role: user.role,
    isActive: user.isActive,
  })

  useEffect(() => {
    setFormData({
      username: user.username,
      email: user.email || '',
      password: '',
      name: user.name,
      role: user.role,
      isActive: user.isActive,
    })
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const updateData: {
        username: string
        email: string | null
        name: string
        role: 'ADMIN' | 'OFFICE_PURCHASING' | 'OFFICE_WAREHOUSE'
        isActive: boolean
        password?: string
      } = {
        username: formData.username,
        email: formData.email || null,
        name: formData.name,
        role: formData.role,
        isActive: formData.isActive,
      }

      // Only include password if it's been changed
      if (formData.password) {
        updateData.password = formData.password
      }

      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      if (response.ok) {
        toast.success(`User "${formData.username}" updated successfully`)
        onSuccess()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to update user')
      }
    } catch {
      toast.error('Failed to update user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[425px]">
        <form onSubmit={handleSubmit} className="overflow-hidden">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information. Leave password blank to keep unchanged.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-username">
                Username <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-username"
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
              <Label htmlFor="edit-name">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="John Doe"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email (Optional)</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="john@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-password">New Password (Optional)</Label>
              <Input
                id="edit-password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="Leave blank to keep current password"
                minLength={6}
              />
              {formData.password && (
                <p className="text-muted-foreground text-xs">
                  Password must be at least 6 characters
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-role">
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
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="edit-active" className="text-base">
                  Active Status
                </Label>
                <div className="text-muted-foreground text-sm">
                  Inactive users cannot login
                </div>
              </div>
              <Switch
                id="edit-active"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
