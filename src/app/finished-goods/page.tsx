'use client'

import { useEffect, useState, useMemo } from 'react'
import { FinishedGood } from '@prisma/client'
import { toast } from 'sonner'
import { useSession } from 'next-auth/react'
import { ArrowDownCircle, ArrowUpCircle, Loader2 } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs } from '@/components/ui/tabs'
import { FinishedGoodsTable } from '@/components/finished-goods/finished-goods-table'
import { AddFinishedGoodDialog } from '@/components/finished-goods/add-finished-good-dialog'
import { EditFinishedGoodDialog } from '@/components/finished-goods/edit-finished-good-dialog'
import { StockEntryDialog } from '@/components/stock/stock-entry-dialog'
import { canManageFinishedGoods, canCreateStockMovement } from '@/lib/rbac'
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
  const [allFinishedGoods, setAllFinishedGoods] = useState<
    (FinishedGood & {
      stocks?: Array<{
        locationId: string
        quantity: number
        location?: { id: string; name: string }
      }>
    })[]
  >([])
  const [isLoading, setIsLoading] = useState(true)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<FinishedGood | null>(
    null
  )
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [stockDialogOpen, setStockDialogOpen] = useState(false)
  const [stockDialogType, setStockDialogType] = useState<'in' | 'out'>('in')

  // Fetch all finished goods once on mount (without locationId to get all stocks)
  const fetchAllFinishedGoods = async () => {
    try {
      const response = await fetch('/api/finished-goods')
      if (!response.ok) {
        throw new Error('Failed to fetch finished goods')
      }
      const data = await response.json()
      // Handle both array response and paginated response
      const goods = Array.isArray(data) ? data : data.data || []
      setAllFinishedGoods(goods)
    } catch (error) {
      logger.error('Error fetching finished goods:', error)
      toast.error('Gagal memuat produk jadi. Silakan refresh halaman.')
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch locations and all finished goods on mount
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
    fetchAllFinishedGoods()
  }, [])

  // Filter by location on client side and sort by stock
  const finishedGoods = useMemo(() => {
    if (!selectedLocation) return []
    const filtered = allFinishedGoods.map((fg) => {
      // Find stock for selected location
      const locationStock = fg.stocks?.find(
        (stock) => stock.locationId === selectedLocation
      )
      return {
        ...fg,
        currentStock: locationStock?.quantity || 0,
      }
    })

    // Sort: items with stock first (descending), then items with 0 stock
    return filtered.sort((a, b) => {
      const aHasStock = a.currentStock > 0
      const bHasStock = b.currentStock > 0

      // If both have stock or both don't have stock, sort by stock descending
      if (aHasStock === bHasStock) {
        return b.currentStock - a.currentStock
      }

      // Items with stock come first
      return aHasStock ? -1 : 1
    })
  }, [allFinishedGoods, selectedLocation])

  const handleSuccess = () => {
    fetchAllFinishedGoods() // Refresh all data
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
      fetchAllFinishedGoods()
    } catch (error) {
      logger.error('Error deleting finished good:', error)
      const message =
        error instanceof Error ? error.message : 'Gagal menghapus produk jadi'
      toast.error(message)
    }
  }

  if (isLoading) {
    return (
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
          Memuat produk jadi...
        </p>
      </div>
    )
  }

  return (
    <div className="space-section">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            Produk Jadi
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Kelola inventori produk jadi Anda
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
          {canCreateStockMovement(userRole, 'finished-good', 'IN') && (
            <Button
              variant="outline"
              onClick={() => {
                setStockDialogType('in')
                setStockDialogOpen(true)
              }}
            >
              <ArrowDownCircle className="mr-2 h-5 w-5" />
              Input Stok Masuk
            </Button>
          )}
          {canCreateStockMovement(userRole, 'finished-good', 'OUT') && (
            <Button
              variant="outline"
              onClick={() => {
                setStockDialogType('out')
                setStockDialogOpen(true)
              }}
            >
              <ArrowUpCircle className="mr-2 h-5 w-5" />
              Input Stok Keluar
            </Button>
          )}
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
            <div className="mb-6 flex flex-wrap gap-0">
              {locations.map((location, index) => (
                <Button
                  key={location.id}
                  variant={selectedLocation === location.id ? 'default' : 'outline'}
                  onClick={() => setSelectedLocation(location.id)}
                  className={`
                    rounded-none border-r-0 transition-all duration-200
                    ${index === 0 ? 'rounded-l-md' : ''}
                    ${index === locations.length - 1 ? 'rounded-r-md border-r' : ''}
                    ${selectedLocation === location.id 
                      ? 'bg-primary text-primary-foreground shadow-sm z-10' 
                      : 'bg-background hover:bg-muted'}
                  `}
                >
                  {location.name}
                </Button>
              ))}
            </div>
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

      <StockEntryDialog
        open={stockDialogOpen}
        onOpenChange={setStockDialogOpen}
        type={stockDialogType}
        entityType="finished-good"
        onSuccess={handleSuccess}
        defaultLocationId={
          stockDialogType === 'out' ? selectedLocation : undefined
        }
      />
    </div>
  )
}
