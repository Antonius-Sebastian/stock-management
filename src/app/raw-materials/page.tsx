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
import { TrendingUp } from "lucide-react"
import { canManageMaterials, canCreateStockMovement } from "@/lib/rbac"

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
      // Handle both array response and paginated response
      const materials = Array.isArray(data) ? data : (data.data || [])
      setRawMaterials(materials)
    } catch (error) {
      console.error("Error fetching raw materials:", error)
      toast.error("Gagal memuat bahan baku. Silakan refresh halaman.")
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
    if (!confirm(`Apakah Anda yakin ingin menghapus "${material.name}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return
    }

    try {
      const response = await fetch(`/api/raw-materials/${material.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || "Gagal menghapus bahan baku")
      }

      toast.success("Bahan baku berhasil dihapus")
      fetchRawMaterials()
    } catch (error) {
      console.error("Error deleting raw material:", error)
      const message = error instanceof Error ? error.message : "Gagal menghapus bahan baku"
      toast.error(message)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Memuat...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Bahan Baku</h1>
          <p className="text-muted-foreground text-sm lg:text-base">
            Kelola inventori bahan baku Anda
          </p>
        </div>
        <div className="flex gap-2">
          {canCreateStockMovement(userRole, 'raw-material', 'IN') && (
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
          )}
          {canManageMaterials(userRole) && (
            <AddRawMaterialDialog onSuccess={handleSuccess} />
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inventori Bahan Baku</CardTitle>
          <CardDescription>
            Lihat dan kelola semua bahan baku dengan indikator level stok
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