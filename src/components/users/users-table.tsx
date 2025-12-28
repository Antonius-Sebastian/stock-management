"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Pencil, Trash2, CheckCircle, XCircle } from "lucide-react"
import { EditUserDialog } from "./edit-user-dialog"
import { toast } from "sonner"
import type { User } from "@/app/users/page"

type UsersTableProps = {
  users: User[]
  onRefresh: () => void
}

export function UsersTable({ users, onRefresh }: UsersTableProps) {
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setEditDialogOpen(true)
  }

  const handleDelete = async (user: User) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus pengguna "${user.username}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast.success(`Pengguna "${user.username}" berhasil dihapus`)
        onRefresh()
      } else {
        const data = await response.json()
        toast.error(data.error || "Gagal menghapus pengguna")
      }
    } catch {
      toast.error("Gagal menghapus pengguna")
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "default"
      case "FACTORY":
        return "secondary"
      case "OFFICE":
        return "outline"
      default:
        return "outline"
    }
  }

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[100px]">Username</TableHead>
              <TableHead className="min-w-[120px]">Nama</TableHead>
              <TableHead className="min-w-[150px]">Email</TableHead>
              <TableHead className="min-w-[80px]">Role</TableHead>
              <TableHead className="min-w-[100px]">Status</TableHead>
              <TableHead className="min-w-[100px]">Dibuat</TableHead>
              <TableHead className="w-[70px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  Tidak ada pengguna ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {user.isActive ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
                          <span className="text-sm text-green-600 dark:text-green-500">Aktif</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-red-600 dark:text-red-500" />
                          <span className="text-sm text-red-600 dark:text-red-500">Nonaktif</span>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Buka menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleEdit(user)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(user)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Hapus
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editingUser && (
        <EditUserDialog
          user={editingUser}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={() => {
            onRefresh()
            setEditDialogOpen(false)
          }}
        />
      )}
    </>
  )
}
