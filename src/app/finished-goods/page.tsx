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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FinishedGoodsTable } from '@/components/finished-goods/finished-goods-table'
import { AddFinishedGoodDialog } from '@/components/finished-goods/add-finished-good-dialog'
import { EditFinishedGoodDialog } from '@/components/finished-goods/edit-finished-good-dialog'
import { canManageFinishedGoods } from '@/lib/rbac'
import { logger } from '@/lib/logger'
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
  const [isLoading, setIsLoading] = useState(true)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<FinishedGood | null>(
    null
  )
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>('')

  const fetchFinishedGoods = async (locationId?: string) => {
    try {
      const url = locationId
        ? `/api/finished-goods?locationId=${locationId}`
        : '/api/finished-goods'
      const response = await fetch(url)
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

  // Fetch locations
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await fetch('/api/locations')
        if (response.ok) {
          const data = await response.json()
          setLocations(data)
          // Set default to first location or default location if available
          if (data.length > 0) {
            const defaultLocation =
              data.find((loc: Location) => loc.isDefault) || data[0]
            setSelectedLocation(defaultLocation.id)
          }
        }
      } catch (error) {
        logger.error('Error fetching locations:', error)
      }
    }
    fetchLocations()
  }, [])

  // Fetch finished goods when location changes
  useEffect(() => {
    if (selectedLocation) {
      setIsLoading(true)
      fetchFinishedGoods(selectedLocation)
    }
  }, [selectedLocation])

  const handleSuccess = () => {
    if (selectedLocation) {
      fetchFinishedGoods(selectedLocation) // Refresh data
    }
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
      if (selectedLocation) {
        fetchFinishedGoods(selectedLocation)
      }
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
          {locations.length > 0 && (
            <Tabs
              value={selectedLocation}
              onValueChange={setSelectedLocation}
              className="mb-6"
            >
              <TabsList className="grid w-full grid-cols-2 sm:inline-grid sm:w-auto">
                {locations.map((location) => (
                  <TabsTrigger
                    key={location.id}
                    value={location.id}
                    className="text-xs sm:text-sm"
                  >
                    {location.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
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
