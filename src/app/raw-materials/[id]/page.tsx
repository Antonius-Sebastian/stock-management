'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { ArrowLeft, Package, TrendingUp } from 'lucide-react'
import { MovementHistoryTable } from '@/components/raw-materials/movement-history-table'
import { BatchDetailDialog } from '@/components/batches/batch-detail-dialog'
import { Batch, BatchUsage, RawMaterial, FinishedGood } from '@prisma/client'
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
  })[]
}

export default function RawMaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const [materialId, setMaterialId] = useState<string>('')
  const [data, setData] = useState<MaterialMovementsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedBatch, setSelectedBatch] = useState<BatchWithUsage | null>(
    null
  )
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false)

  useEffect(() => {
    params.then((p) => setMaterialId(p.id))
  }, [params])

  useEffect(() => {
    if (!materialId) return

    const fetchMaterialMovements = async () => {
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
        toast.error('Failed to load material details. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchMaterialMovements()
  }, [materialId])

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-4">
        <div className="text-muted-foreground text-lg">Material not found</div>
        <Button onClick={() => router.push('/raw-materials')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Raw Materials
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
      toast.error('Failed to load batch details. Please try again.')
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
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Raw Materials
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{material.kode}</h1>
          <h2 className="text-muted-foreground text-xl">{material.name}</h2>
        </div>
      </div>

      {/* Material Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Stock</CardTitle>
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
              Minimum Order Quantity
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Movements
            </CardTitle>
            <TrendingUp className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{movements.length}</div>
            <p className="text-muted-foreground mt-1 text-xs">
              All-time transactions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Movement History */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Movement History</CardTitle>
          <CardDescription>
            Complete history of stock movements for this material
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MovementHistoryTable
            movements={movements}
            onBatchClick={handleBatchClick}
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
