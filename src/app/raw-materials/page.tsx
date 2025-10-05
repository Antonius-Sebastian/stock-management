"use client"

import { useEffect, useState } from "react"
import { RawMaterial } from "@prisma/client"
import { toast } from "sonner"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RawMaterialsTable } from "@/components/raw-materials/raw-materials-table"
import { AddRawMaterialDialog } from "@/components/raw-materials/add-raw-material-dialog"
import { EditRawMaterialDialog } from "@/components/raw-materials/edit-raw-material-dialog"
import { StockEntryDialog } from "@/components/stock/stock-entry-dialog"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown } from "lucide-react"
import { canManageMaterials } from "@/lib/rbac"

export default function RawMaterialsPage() {
  const { data: session } = useSession()
  const userRole = session?.user?.role
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null)

  const fetchRawMaterials = async () => {
    try {
      const response = await fetch("/api/raw-materials")
      if (!response.ok) {
        throw new Error("Failed to fetch raw materials")
      }
      const data = await response.json()
      setRawMaterials(data)
    } catch (error) {
      console.error("Error fetching raw materials:", error)
      toast.error("Failed to load raw materials. Please refresh the page.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRawMaterials()
  }, [])

  const handleSuccess = () => {
    fetchRawMaterials()
  }

  const handleEdit = (material: RawMaterial) => {
    setSelectedMaterial(material)
    setEditDialogOpen(true)
  }

  const handleDelete = async (material: RawMaterial) => {
    if (!confirm(`Are you sure you want to delete "${material.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/raw-materials/${material.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || "Failed to delete raw material")
      }

      toast.success("Raw material deleted successfully")
      fetchRawMaterials()
    } catch (error) {
      console.error("Error deleting raw material:", error)
      const message = error instanceof Error ? error.message : "Failed to delete raw material"
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
          <h1 className="text-3xl font-bold tracking-tight">Raw Materials</h1>
          <p className="text-muted-foreground">
            Manage your raw material inventory
          </p>
        </div>
        <div className="flex gap-2">
          <StockEntryDialog
            type="IN"
            itemType="raw-material"
            onSuccess={handleSuccess}
          >
            <Button variant="outline">
              <TrendingUp className="mr-2 h-4 w-4" />
              Input Stok Masuk
            </Button>
          </StockEntryDialog>
          <StockEntryDialog
            type="OUT"
            itemType="raw-material"
            onSuccess={handleSuccess}
          >
            <Button variant="outline">
              <TrendingDown className="mr-2 h-4 w-4" />
              Input Stok Keluar
            </Button>
          </StockEntryDialog>
          {canManageMaterials(userRole) && (
            <AddRawMaterialDialog onSuccess={handleSuccess} />
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Raw Materials Inventory</CardTitle>
          <CardDescription>
            View and manage all raw materials with stock level indicators
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RawMaterialsTable
            data={rawMaterials}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onRefresh={handleSuccess}
            userRole={userRole}
          />
        </CardContent>
      </Card>

      <EditRawMaterialDialog
        material={selectedMaterial}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={handleSuccess}
      />
    </div>
  )
}