"use client"

import { useEffect, useState } from "react"
import { Batch, BatchUsage, RawMaterial, FinishedGood } from "@prisma/client"
import { toast } from "sonner"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BatchesTable } from "@/components/batches/batches-table"
import { AddBatchDialog } from "@/components/batches/add-batch-dialog-new"
import { EditBatchDialog } from "@/components/batches/edit-batch-dialog"
import { BatchDetailDialog } from "@/components/batches/batch-detail-dialog"
import { canCreateBatches } from "@/lib/rbac"

type BatchWithUsage = Batch & {
  finishedGood?: FinishedGood | null
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
  const [selectedBatch, setSelectedBatch] = useState<BatchWithUsage | null>(null)

  const fetchBatches = async () => {
    try {
      const response = await fetch("/api/batches")
      if (!response.ok) {
        throw new Error("Failed to fetch batches")
      }
      const data = await response.json()
      setBatches(data)
    } catch (error) {
      console.error("Error fetching batches:", error)
      toast.error("Failed to load batches. Please refresh the page.")
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
    if (!confirm(`Are you sure you want to delete batch "${batch.code}"? This will restore the stock of raw materials used. This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/batches/${batch.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || "Failed to delete batch")
      }

      toast.success("Batch deleted successfully and stock restored")
      fetchBatches()
    } catch (error) {
      console.error("Error deleting batch:", error)
      const message = error instanceof Error ? error.message : "Failed to delete batch"
      toast.error(message)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Batch Usage</h1>
          <p className="text-muted-foreground">
            Track raw material consumption for production batches
          </p>
        </div>
        {canCreateBatches(userRole) && (
          <AddBatchDialog onSuccess={handleSuccess} />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Production Batches</CardTitle>
          <CardDescription>
            History of raw material usage for production batches
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BatchesTable
            data={batches}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            userRole={userRole}
          />
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