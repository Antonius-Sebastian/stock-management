'use client'

import { useEffect, useState } from 'react'
import { UsersTable } from '@/components/users/users-table'
import { AddUserDialog } from '@/components/users/add-user-dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { UserPlus } from 'lucide-react'
import { logger } from '@/lib/logger'

export type User = {
  id: string
  username: string
  email: string | null
  name: string
  role: 'ADMIN' | 'OFFICE_PURCHASING' | 'OFFICE_WAREHOUSE'
  isActive: boolean
  createdAt: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      }
    } catch (error) {
      logger.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight lg:text-3xl">
              Manajemen User
            </h2>
            <p className="text-muted-foreground">
              Kelola user sistem dan peran mereka
            </p>
          </div>
        </div>
        <AddUserDialog onSuccess={fetchUsers}>
          <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            Tambah User
          </Button>
        </AddUserDialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User</CardTitle>
          <CardDescription>
            Daftar semua user dengan peran dan status mereka
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Memuat user...</p>
            </div>
          ) : (
            <UsersTable users={users} onRefresh={fetchUsers} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
