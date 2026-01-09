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
    role: 'OFFICE_PURCHASING' as
      | 'ADMIN'
      | 'OFFICE_PURCHASING'
      | 'OFFICE_WAREHOUSE',
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
        toast.success(`User "${formData.username}" berhasil dibuat`)
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
        toast.error(data.error || 'Gagal membuat pengguna')
      }
    } catch {
      toast.error('Gagal membuat pengguna')
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
            <DialogTitle>Tambah User Baru</DialogTitle>
            <DialogDescription>
              Buat akun user baru. Password default dapat diubah setelah login.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="username">
                Nama Pengguna <span className="text-red-500">*</span>
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
                Nama Lengkap <span className="text-red-500">*</span>
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
              <Label htmlFor="email">Email (Opsional)</Label>
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
                Kata Sandi <span className="text-red-500">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="Min. 6 karakter"
                required
                minLength={6}
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="role">
                  Peran <span className="text-red-500">*</span>
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="text-muted-foreground h-4 w-4 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <div className="space-y-2">
                        <div>
                          <p className="font-semibold">Admin</p>
                          <p className="mt-1 text-xs">
                            Akses Penuh - Dapat mengakses semua fitur sistem
                          </p>
                        </div>
                        <div>
                          <p className="font-semibold">Office Purchasing</p>
                          <p className="mt-1 text-xs">
                            • Stok Masuk Bahan Baku
                          </p>
                          <p className="text-xs">• Stok Keluar Produk Jadi</p>
                        </div>
                        <div>
                          <p className="font-semibold">Office Warehouse</p>
                          <p className="mt-1 text-xs">
                            • Stok Masuk Produk Jadi
                          </p>
                          <p className="text-xs">• Stok Keluar Bahan Baku</p>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Select
                value={formData.role}
                onValueChange={(
                  value: 'ADMIN' | 'OFFICE_PURCHASING' | 'OFFICE_WAREHOUSE'
                ) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih peran" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="OFFICE_PURCHASING">
                    Office Purchasing
                  </SelectItem>
                  <SelectItem value="OFFICE_WAREHOUSE">
                    Office Warehouse
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
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Membuat...' : 'Buat User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
