"use client"

import { useEffect, useState } from "react"
import { Batch, BatchUsage, RawMaterial, FinishedGood } from "@prisma/client"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BatchesTable } from "@/components/batches/batches-table"
import { AddBatchDialog } from "@/components/batches/add-batch-dialog-new"

type BatchWithUsage = Batch & {
  finishedGood?: FinishedGood | null
  batchUsages: (BatchUsage & {
    rawMaterial: RawMaterial
  })[]
}

export default function BatchesPage() {
  const [batches, setBatches] = useState<BatchWithUsage[]>([])
  const [isLoading, setIsLoading] = useState(true)

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
        <AddBatchDialog onSuccess={handleSuccess} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Production Batches</CardTitle>
          <CardDescription>
            History of raw material usage for production batches
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BatchesTable data={batches} />
        </CardContent>
      </Card>
    </div>
  )
}