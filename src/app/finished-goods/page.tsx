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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ManageLocationsDialog } from '@/components/locations/manage-locations-dialog'

interface Location {
  id: string
  name: string
  isDefault: boolean
}

export default function FinishedGoodsPage() {
  const { data: session } = useSession()
  const userRole = session?.user?.role
  const [finishedGoods, setFinishedGoods] = useState<FinishedGood[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<FinishedGood | null>(null)
  const [currentTab, setCurrentTab] = useState('all')

  const fetchFinishedGoods = async () => { /* ... existing fetch ... */ }
  
  const fetchLocations = async () => {
    try {
        const response = await fetch('/api/locations')
        if (response.ok) {
            const data = await response.json()
            setLocations(data)
        }
    } catch (error) {
        console.error('Failed to fetch locations', error)
    }
  }

  useEffect(() => {
    Promise.all([fetchFinishedGoods(), fetchLocations()]).finally(() => setIsLoading(false))
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

  const getFilteredData = () => {
      if (currentTab === 'all') return finishedGoods;
      
      return finishedGoods.map(item => {
          // Find stock for specific location
          // Note: item.stocks is not on FinishedGood type by default, need to extend or cast if using raw Prisma type
          // But API returns it. We might need to type it properly or cast.
          const stock = (item as any).stocks?.find((s: any) => s.locationId === currentTab);
          return {
              ...item,
              currentStock: stock ? stock.quantity : 0
          };
      });
  }

  const filteredData = getFilteredData();

  if (isLoading) { /* ... loading ... */ }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          {/* ... title ... */}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {canManageFinishedGoods(userRole) && (
                 <ManageLocationsDialog onLocationsChange={fetchLocations} />
            )}
           {/* ... other buttons ... */}
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
        <div className="flex items-center justify-between mb-4">
            <TabsList>
                <TabsTrigger value="all">Semua Lokasi</TabsTrigger>
                {locations.map(loc => (
                    <TabsTrigger key={loc.id} value={loc.id}>{loc.name}</TabsTrigger>
                ))}
            </TabsList>
        </div>

        <TabsContent value="all" className="mt-0">
             <Card>
                <CardHeader>
                  <CardTitle>Inventori Produk Jadi (Total)</CardTitle>
                  <CardDescription>Lihat total stok di semua lokasi</CardDescription>
                </CardHeader>
                <CardContent>
                  <FinishedGoodsTable
                    data={filteredData}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onRefresh={handleSuccess}
                    userRole={userRole}
                  />
                </CardContent>
              </Card>
        </TabsContent>

        {locations.map(loc => (
             <TabsContent key={loc.id} value={loc.id} className="mt-0">
                <Card>
                    <CardHeader>
                    <CardTitle>Inventori: {loc.name}</CardTitle>
                    <CardDescription>Stok di lokasi {loc.name}</CardDescription>
                    </CardHeader>
                    <CardContent>
                    <FinishedGoodsTable
                        data={filteredData}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onRefresh={handleSuccess}
                        userRole={userRole}
                    />
                    </CardContent>
                </Card>
             </TabsContent>
        ))}
      </Tabs>

      {/* ... dialogs ... */}
    </div>
  )
}
