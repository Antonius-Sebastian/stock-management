"use client"

import { useEffect, useState } from "react"
import { FinishedGood } from "@prisma/client"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FinishedGoodsTable } from "@/components/finished-goods/finished-goods-table"
import { AddFinishedGoodDialog } from "@/components/finished-goods/add-finished-good-dialog"
import { StockEntryDialog } from "@/components/stock/stock-entry-dialog"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown } from "lucide-react"

export default function FinishedGoodsPage() {
  const [finishedGoods, setFinishedGoods] = useState<FinishedGood[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchFinishedGoods = async () => {
    try {
      const response = await fetch("/api/finished-goods")
      if (!response.ok) {
        throw new Error("Failed to fetch finished goods")
      }
      const data = await response.json()
      setFinishedGoods(data)
    } catch (error) {
      console.error("Error fetching finished goods:", error)
      toast.error("Failed to load finished goods. Please refresh the page.")
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
          <h1 className="text-3xl font-bold tracking-tight">Finished Goods</h1>
          <p className="text-muted-foreground">
            Manage your finished goods inventory
          </p>
        </div>
        <div className="flex gap-2">
          <StockEntryDialog
            type="IN"
            itemType="finished-good"
            onSuccess={handleSuccess}
          >
            <Button variant="outline">
              <TrendingUp className="mr-2 h-4 w-4" />
              Input Stok Masuk
            </Button>
          </StockEntryDialog>
          <StockEntryDialog
            type="OUT"
            itemType="finished-good"
            onSuccess={handleSuccess}
          >
            <Button variant="outline">
              <TrendingDown className="mr-2 h-4 w-4" />
              Input Stok Keluar
            </Button>
          </StockEntryDialog>
          <AddFinishedGoodDialog onSuccess={handleSuccess} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Finished Goods Inventory</CardTitle>
          <CardDescription>
            View and manage all finished goods products
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FinishedGoodsTable data={finishedGoods} />
        </CardContent>
      </Card>
    </div>
  )
}