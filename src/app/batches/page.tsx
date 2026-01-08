'use client'

import { useEffect, useState } from 'react'
import { Batch, BatchUsage, RawMaterial } from '@prisma/client'
import { toast } from 'sonner'
import { useSession } from 'next-auth/react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { BatchesTable } from '@/components/batches/batches-table'
import { AddBatchDialog } from '@/components/batches/add-batch-dialog'
import { EditBatchDialog } from '@/components/batches/edit-batch-dialog'
import { BatchDetailDialog } from '@/components/batches/batch-detail-dialog'
import { canCreateBatches } from '@/lib/rbac'
import { logger } from '@/lib/logger'

type BatchWithUsage = Batch & {
  batchUsages: (BatchUsage & {
    rawMaterial: RawMaterial
  })[]
}

export default function BatchesPage() {
  const { data: session } = useSession()
  const userRole = session?.user?.role
  const [batches, setBatches] = useState<BatchWithUsage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState<BatchWithUsage | null>(
    null
  )

  const fetchBatches = async () => {
    try {
      const response = await fetch('/api/batches')
      if (!response.ok) {
        throw new Error('Failed to fetch batches')
      }
      const data = await response.json()
      // Handle both array response and paginated response
      const batches = Array.isArray(data) ? data : data.data || []
      setBatches(batches)
    } catch (error) {
      logger.error('Error fetching batches:', error)
      toast.error('Gagal memuat batches. Silakan refresh halaman.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchBatches()
  }, [])

  const handleSuccess = () => {
    fetchBatches()
  }

  const handleView = (batch: BatchWithUsage) => {
    setSelectedBatch(batch)
    setDetailDialogOpen(true)
  }

  const handleEdit = (batch: BatchWithUsage) => {
    setSelectedBatch(batch)
    setEditDialogOpen(true)
  }

  const handleDelete = async (batch: BatchWithUsage) => {
    if (
      !confirm(
        `Apakah Anda yakin ingin menghapus batch "${batch.code}"? Stok bahan baku yang digunakan akan dikembalikan. Tindakan ini tidak dapat dibatalkan.`
      )
    ) {
      return
    }

    try {
      const response = await fetch(`/api/batches/${batch.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Gagal menghapus batch')
      }

      toast.success('Batch berhasil dihapus dan stok dikembalikan')
      fetchBatches()
    } catch (error) {
      logger.error('Error deleting batch:', error)
      const message =
        error instanceof Error ? error.message : 'Gagal menghapus batch'
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
              Pemakaian Batch
            </h1>
            <p className="text-muted-foreground">
              Lacak konsumsi bahan baku untuk batch produksi
            </p>
          </div>
        </div>
        {canCreateBatches(userRole) && (
          <div data-tour="create-batch">
            <AddBatchDialog onSuccess={handleSuccess} />
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Batch Produksi</CardTitle>
          <CardDescription>
            Riwayat pemakaian bahan baku untuk batch produksi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div data-tour="batches-table">
            <BatchesTable
              data={batches}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              userRole={userRole}
            />
          </div>
        </CardContent>
      </Card>

      <BatchDetailDialog
        batch={selectedBatch}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />

      <EditBatchDialog
        batch={selectedBatch}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
