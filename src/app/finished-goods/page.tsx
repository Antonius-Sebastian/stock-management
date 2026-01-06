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
import { StockEntryDialog } from '@/components/stock/stock-entry-dialog'
import { HelpButton } from '@/components/help/help-button'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { canManageFinishedGoods, canCreateStockMovement } from '@/lib/rbac'
import { logger } from '@/lib/logger'

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
    fetchFinishedGoods()
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
          {canCreateStockMovement(userRole, 'finished-good', 'IN') && (
            <StockEntryDialog
              type="IN"
              itemType="finished-good"
              onSuccess={handleSuccess}
            >
              <Button variant="outline" className="w-full sm:w-auto">
                <TrendingUp className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Input </span>Stok Masuk
              </Button>
            </StockEntryDialog>
          )}
          {canCreateStockMovement(userRole, 'finished-good', 'OUT') && (
            <StockEntryDialog
              type="OUT"
              itemType="finished-good"
              onSuccess={handleSuccess}
            >
              <Button variant="outline" className="w-full sm:w-auto">
                <TrendingDown className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Input </span>Stok Keluar
              </Button>
            </StockEntryDialog>
          )}
          {canManageFinishedGoods(userRole) && (
            <AddFinishedGoodDialog onSuccess={handleSuccess} />
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inventori Produk Jadi</CardTitle>
          <CardDescription>Lihat dan kelola semua produk jadi</CardDescription>
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
