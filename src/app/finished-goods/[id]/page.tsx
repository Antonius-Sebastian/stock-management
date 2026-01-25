'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StockLevelBadge } from '@/components/ui/stock-level-badge'
import { ArrowLeft, Package, TrendingUp, Loader2 } from 'lucide-react'
import { FinishedGoodMovementHistoryTable } from '@/components/finished-goods/movement-history-table'
import { BatchDetailDialog } from '@/components/batches/batch-detail-dialog'
import { Batch, BatchUsage, RawMaterial, FinishedGood } from '@prisma/client'
import { logger } from '@/lib/logger'

interface ProductDetail {
  id: string
  name: string
  currentStock: number
}

interface Movement {
  id: string
  type: 'IN' | 'OUT' | 'ADJUSTMENT'
  quantity: number
  date: string
  description: string | null
  batch: { id: string; code: string } | null
  location: { id: string; name: string } | null
  runningBalance: number
  createdAt: string
}

interface ProductMovementsResponse {
  finishedGood: ProductDetail
  movements: Movement[]
}

interface Location {
  id: string
  name: string
  isDefault: boolean
}

type BatchWithUsage = Batch & {
  finishedGood?: FinishedGood | null
  batchUsages: (BatchUsage & {
    rawMaterial: RawMaterial
    drum: {
      id: string
      label: string
    } | null
  })[]
}

export default function FinishedGoodDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { data: session } = useSession()
  const userRole = session?.user?.role
  const [productId, setProductId] = useState<string>('')
  const [data, setData] = useState<ProductMovementsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedBatch, setSelectedBatch] = useState<BatchWithUsage | null>(
    null
  )
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false)
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>('')

  useEffect(() => {
    params.then((p) => setProductId(p.id))
  }, [params])

  const fetchProductMovements = async () => {
    if (!productId || !selectedLocation) return
    try {
      const url = `/api/finished-goods/${productId}/movements?locationId=${selectedLocation}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch product details')
      }
      const result = await response.json()
      setData(result)
    } catch (error) {
      logger.error('Error fetching product movements:', error)
      toast.error('Gagal memuat detail produk. Silakan coba lagi.')
    } finally {
      setIsLoading(false)
    }
  }

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

  useEffect(() => {
    if (!productId) return
    fetchLocations()
  }, [productId])

  useEffect(() => {
    if (!productId || !selectedLocation) return
    fetchProductMovements()
  }, [productId, selectedLocation])

  if (isLoading && !selectedLocation) {
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
          Memuat lokasi...
        </p>
      </div>
    )
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
          Memuat...
        </p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-4">
        <div className="text-muted-foreground text-lg">
          Produk tidak ditemukan
        </div>
        <Button onClick={() => router.push('/finished-goods')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali ke Produk Jadi
        </Button>
      </div>
    )
  }

  const { finishedGood, movements } = data

  const handleBatchClick = async (batchId: string) => {
    try {
      const response = await fetch(`/api/batches/${batchId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch batch details')
      }
      const batch = await response.json()
      setSelectedBatch(batch)
      setIsBatchDialogOpen(true)
    } catch (error) {
      logger.error('Error fetching batch details:', error)
      toast.error('Gagal memuat detail batch. Silakan coba lagi.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Button
            variant="ghost"
            className="mb-2 -ml-2"
            onClick={() => router.push('/finished-goods')}
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            Kembali ke Produk Jadi
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">
            {finishedGood.name}
          </h1>
        </div>
      </div>

      {/* Location Filter */}
      {locations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Lokasi</CardTitle>
            <CardDescription>
              Pilih lokasi untuk melihat stok dan pergerakan di lokasi tertentu
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {locations.map((location) => (
                <Button
                  key={location.id}
                  variant={
                    selectedLocation === location.id ? 'default' : 'outline'
                  }
                  size="sm"
                  onClick={() => setSelectedLocation(location.id)}
                >
                  {location.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stok Saat Ini</CardTitle>
            <Package className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {finishedGood.currentStock.toLocaleString()}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {selectedLocation
                ? `Di lokasi ${
                    locations.find((l) => l.id === selectedLocation)?.name
                  }`
                : 'Pilih lokasi'}
            </p>
            <div className="mt-2">
              <StockLevelBadge stock={finishedGood.currentStock} moq={0} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Pergerakan
            </CardTitle>
            <TrendingUp className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{movements.length}</div>
            <p className="text-muted-foreground mt-1 text-xs">
              Semua transaksi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lokasi</CardTitle>
            <Package className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {selectedLocation
                ? locations.find((l) => l.id === selectedLocation)?.name ||
                  'Pilih lokasi'
                : 'Pilih lokasi'}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {selectedLocation
                ? 'Lokasi terpilih'
                : 'Pilih lokasi terlebih dahulu'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Movement History */}
      <Card>
        <CardHeader>
          <CardTitle>Riwayat Pergerakan Stok</CardTitle>
          <CardDescription>
            Riwayat lengkap pergerakan stok untuk produk ini
            {selectedLocation
              ? ` di lokasi ${
                  locations.find((l) => l.id === selectedLocation)?.name
                }`
              : ' - Pilih lokasi terlebih dahulu'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedLocation ? (
            <FinishedGoodMovementHistoryTable
              movements={movements}
              onBatchClick={handleBatchClick}
              userRole={userRole}
              onRefresh={fetchProductMovements}
            />
          ) : (
            <div className="text-muted-foreground py-8 text-center">
              Pilih lokasi terlebih dahulu untuk melihat riwayat pergerakan
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batch Detail Dialog */}
      <BatchDetailDialog
        batch={selectedBatch}
        open={isBatchDialogOpen}
        onOpenChange={setIsBatchDialogOpen}
      />
    </div>
  )
}
