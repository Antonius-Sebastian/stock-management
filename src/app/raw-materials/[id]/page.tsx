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
import { Checkbox } from '@/components/ui/checkbox'
import { StockLevelBadge } from '@/components/ui/stock-level-badge'
import { ArrowLeft, Package, TrendingUp, Loader2 } from 'lucide-react'
import { MovementHistoryTable } from '@/components/raw-materials/movement-history-table'
import { BatchDetailDialog } from '@/components/batches/batch-detail-dialog'
import {
  Batch,
  BatchUsage,
  RawMaterial,
  FinishedGood,
  Drum,
} from '@prisma/client'
import { logger } from '@/lib/logger'

interface MaterialDetail {
  id: string
  kode: string
  name: string
  currentStock: number
  moq: number
}

interface Movement {
  id: string
  type: 'IN' | 'OUT'
  quantity: number
  date: string
  description: string | null
  batch: { id: string; code: string } | null
  drum: { label: string } | null
  runningBalance: number
  createdAt: string
}

interface MaterialMovementsResponse {
  material: MaterialDetail
  movements: Movement[]
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

export default function RawMaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { data: session } = useSession()
  const userRole = session?.user?.role
  const [materialId, setMaterialId] = useState<string>('')
  const [data, setData] = useState<MaterialMovementsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedBatch, setSelectedBatch] = useState<BatchWithUsage | null>(
    null
  )
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false)
  const [drums, setDrums] = useState<Drum[]>([])
  const [isLoadingDrums, setIsLoadingDrums] = useState(false)
  const [showEmptyDrums, setShowEmptyDrums] = useState(false)

  useEffect(() => {
    params.then((p) => setMaterialId(p.id))
  }, [params])

  const fetchMaterialMovements = async () => {
    if (!materialId) return
    try {
      const response = await fetch(
        `/api/raw-materials/${materialId}/movements`
      )
      if (!response.ok) {
        throw new Error('Failed to fetch material details')
      }
      const result = await response.json()
      setData(result)
    } catch (error) {
      logger.error('Error fetching material movements:', error)
      toast.error('Gagal memuat detail bahan baku. Silakan coba lagi.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!materialId) return
    fetchMaterialMovements()

    // Fetch drums for this material
    const fetchDrums = async () => {
      if (!materialId) return
      setIsLoadingDrums(true)
      try {
        const response = await fetch(
          `/api/raw-materials/${materialId}?include=drums`
        )
        if (response.ok) {
          const data = await response.json()
          setDrums(data.drums || [])
        }
      } catch (error) {
        logger.error('Error fetching drums:', error)
      } finally {
        setIsLoadingDrums(false)
      }
    }
    fetchDrums()
  }, [materialId])

  // Client-side filtering for empty drums - MUST be called before early returns
  // Note: Drums with 0 stock are always inactive, so filtering by currentQuantity covers both
  const filteredDrums = useMemo(() => {
    if (showEmptyDrums) {
      return drums
    }
    return drums.filter((drum) => drum.currentQuantity > 0)
  }, [drums, showEmptyDrums])

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
          Bahan baku tidak ditemukan
        </div>
        <Button onClick={() => router.push('/raw-materials')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali ke Bahan Baku
        </Button>
      </div>
    )
  }

  const { material, movements } = data

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
            onClick={() => router.push('/raw-materials')}
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            Kembali ke Bahan Baku
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{material.kode}</h1>
          <h2 className="text-muted-foreground text-xl">{material.name}</h2>
        </div>
      </div>

      {/* Material Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stok Saat Ini</CardTitle>
            <Package className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {material.currentStock.toLocaleString()}
            </div>
            <div className="mt-2">
              <StockLevelBadge
                stock={material.currentStock}
                moq={material.moq}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MOQ</CardTitle>
            <TrendingUp className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {material.moq.toLocaleString()}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              Jumlah Pesanan Minimum
            </p>
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
      </div>

      {/* Drums Section */}
      {drums.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Drum</CardTitle>
                <CardDescription>
                  Daftar drum yang tersedia untuk bahan baku ini
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-empty-drums"
                  checked={showEmptyDrums}
                  onCheckedChange={(checked) =>
                    setShowEmptyDrums(checked === true)
                  }
                />
                <label
                  htmlFor="show-empty-drums"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Tampilkan drum kosong
                </label>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4 font-medium">Label</th>
                    <th className="text-left py-2 px-4 font-medium">
                      Stok Tersedia
                    </th>
                    <th className="text-left py-2 px-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDrums.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="text-muted-foreground py-8 text-center"
                      >
                        Tidak ada drum yang ditampilkan
                      </td>
                    </tr>
                  ) : (
                    filteredDrums.map((drum) => (
                      <tr key={drum.id} className="border-b">
                        <td className="py-2 px-4">{drum.label}</td>
                        <td className="py-2 px-4">
                          {drum.currentQuantity.toLocaleString()}
                        </td>
                        <td className="py-2 px-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              drum.isActive
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                            }`}
                          >
                            {drum.isActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {drums.length > 0 && (
                <p className="text-muted-foreground mt-4 text-sm">
                  Menampilkan {filteredDrums.length} dari {drums.length} drum
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Movement History */}
      <Card>
        <CardHeader>
          <CardTitle>Riwayat Pergerakan Stok</CardTitle>
          <CardDescription>
            Riwayat lengkap pergerakan stok untuk bahan baku ini
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MovementHistoryTable
            movements={movements}
            onBatchClick={handleBatchClick}
            userRole={userRole}
            itemType="raw-material"
            onRefresh={fetchMaterialMovements}
          />
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
