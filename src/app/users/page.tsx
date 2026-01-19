'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
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
import { UserPlus, Loader2 } from 'lucide-react'
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
  const { data: session } = useSession()
  const userRole = session?.user?.role
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Manajemen User
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            Kelola user sistem dan peran mereka
          </p>
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
            <div className="flex h-64 flex-col items-center justify-center space-y-4">
              <div className="relative">
                <Loader2 className="text-primary h-12 w-12 animate-spin transition-opacity duration-300" />
                <Loader2
                  className="text-primary/50 absolute inset-0 h-12 w-12 animate-spin transition-opacity duration-300"
                  style={{
                    animationDirection: 'reverse',
                    animationDuration: '1.5s',
                  }}
                />
              </div>
              <p className="text-muted-foreground animate-pulse text-sm font-medium">
                Memuat user...
              </p>
            </div>
          ) : (
            <UsersTable
              users={users}
              onRefresh={fetchUsers}
              userRole={userRole}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
