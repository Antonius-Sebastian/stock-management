'use client'

import { useEffect, useState } from 'react'
import { FinishedGood } from '@prisma/client'
import { toast } from 'sonner'
import { useSession } from 'next-auth/react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FinishedGoodsTable } from '@/components/finished-goods/finished-goods-table'
import { AddFinishedGoodDialog } from '@/components/finished-goods/add-finished-good-dialog'
import { EditFinishedGoodDialog } from '@/components/finished-goods/edit-finished-good-dialog'
import { HelpButton } from '@/components/help/help-button'
import { canManageFinishedGoods } from '@/lib/rbac'
import { logger } from '@/lib/logger'
import { ManageLocationsDialog } from '@/components/locations/manage-locations-dialog'

export default function FinishedGoodsPage() {
  const { data: session } = useSession()
  const userRole = session?.user?.role
  const [finishedGoods, setFinishedGoods] = useState<FinishedGood[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<FinishedGood | null>(
    null
  )

  const fetchFinishedGoods = async () => {
    try {
      const response = await fetch('/api/finished-goods')
      if (!response.ok) {
        throw new Error('Failed to fetch finished goods')
      }
      const data = await response.json()
      // Handle both array response and paginated response
      const goods = Array.isArray(data) ? data : data.data || []
      setFinishedGoods(goods)
    } catch (error) {
      logger.error('Error fetching finished goods:', error)
      toast.error('Gagal memuat produk jadi. Silakan refresh halaman.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchFinishedGoods()
  }, [])

  const handleSuccess = () => {
    fetchFinishedGoods() // Refresh data
  }

  const handleEdit = (product: FinishedGood) => {
    setSelectedProduct(product)
    setEditDialogOpen(true)
  }

  const handleDelete = async (product: FinishedGood) => {
    if (
      !confirm(
        `Apakah Anda yakin ingin menghapus "${product.name}"? Tindakan ini tidak dapat dibatalkan.`
      )
    ) {
      return
    }

    try {
      const response = await fetch(`/api/finished-goods/${product.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Gagal menghapus produk jadi')
      }

      toast.success('Produk jadi berhasil dihapus')
      fetchFinishedGoods()
    } catch (error) {
      logger.error('Error deleting finished good:', error)
      const message =
        error instanceof Error ? error.message : 'Gagal menghapus produk jadi'
      toast.error(message)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-lg">Memuat...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
              Produk Jadi
            </h1>
            <p className="text-muted-foreground text-sm lg:text-base">
              Kelola inventori produk jadi Anda
            </p>
          </div>
          <HelpButton pageId="finished-goods" />
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {canManageFinishedGoods(userRole) && (
            <>
              <ManageLocationsDialog />
              <AddFinishedGoodDialog onSuccess={handleSuccess} />
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inventori Produk Jadi</CardTitle>
          <CardDescription>
            Kelola semua produk jadi. Stok per lokasi dikelola melalui dialog
            stok masuk/keluar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FinishedGoodsTable
            data={finishedGoods}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onRefresh={handleSuccess}
            userRole={userRole}
          />
        </CardContent>
      </Card>

      <EditFinishedGoodDialog
        product={selectedProduct}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
