'use client'

import { useEffect, useState, useMemo } from 'react'
import { RawMaterial } from '@prisma/client'
import { toast } from 'sonner'
import { useSession } from 'next-auth/react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { RawMaterialsTable } from '@/components/raw-materials/raw-materials-table'
import { AddRawMaterialDialog } from '@/components/raw-materials/add-raw-material-dialog'
import { EditRawMaterialDialog } from '@/components/raw-materials/edit-raw-material-dialog'
import { DrumStockEntryDialog } from '@/components/raw-materials/drum-stock-entry-dialog'
import { logger } from '@/lib/logger'
import { canManageMaterials, canCreateStockMovement } from '@/lib/rbac'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export default function RawMaterialsPage() {
  const { data: session } = useSession()
  const userRole = session?.user?.role
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(
    null
  )
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [materialToDelete, setMaterialToDelete] = useState<RawMaterial | null>(
    null
  )
  const [movementCount, setMovementCount] = useState(0)

  const fetchRawMaterials = async () => {
    try {
      const response = await fetch('/api/raw-materials')
      if (!response.ok) {
        throw new Error('Failed to fetch raw materials')
      }
      const data = await response.json()
      // Handle both array response and paginated response
      const materials = Array.isArray(data) ? data : data.data || []
      setRawMaterials(materials)
    } catch (error) {
      logger.error('Error fetching raw materials:', error)
      toast.error('Gagal memuat bahan baku. Silakan refresh halaman.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRawMaterials()
  }, [])

  // Sort raw materials: items with stock first (descending), then items with 0 stock
  const sortedRawMaterials = useMemo(() => {
    return [...rawMaterials].sort((a, b) => {
      const aHasStock = a.currentStock > 0
      const bHasStock = b.currentStock > 0

      // If both have stock or both don't have stock, sort by stock descending
      if (aHasStock === bHasStock) {
        return b.currentStock - a.currentStock
      }

      // Items with stock come first
      return aHasStock ? -1 : 1
    })
  }, [rawMaterials])

  const handleSuccess = () => {
    fetchRawMaterials()
  }

  const handleEdit = (material: RawMaterial) => {
    setSelectedMaterial(material)
    setEditDialogOpen(true)
  }

  const handleDelete = async (material: RawMaterial) => {
    // Fetch movement count
    try {
      const response = await fetch(
        `/api/raw-materials/${material.id}/movements`
      )
      if (response.ok) {
        const data = await response.json()
        setMovementCount(data.movements?.length || 0)
      }
    } catch (error) {
      logger.error('Error fetching movements:', error)
      setMovementCount(0)
    }

    setMaterialToDelete(material)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!materialToDelete) return

    try {
      const response = await fetch(
        `/api/raw-materials/${materialToDelete.id}`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Gagal menghapus bahan baku')
      }

      toast.success('Bahan baku berhasil dihapus')
      fetchRawMaterials()
      setDeleteDialogOpen(false)
      setMaterialToDelete(null)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gagal menghapus bahan baku'
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
              Bahan Baku
            </h1>
            <p className="text-muted-foreground text-sm lg:text-base">
              Kelola inventori bahan baku Anda
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canCreateStockMovement(userRole, 'raw-material', 'IN') && (
            <DrumStockEntryDialog onSuccess={handleSuccess} />
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
            data={sortedRawMaterials}
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Bahan Baku?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus &quot;{materialToDelete?.name}
              &quot;?
              {movementCount > 0 && (
                <>
                  <br />
                  <br />
                  <span className="text-destructive font-semibold">
                    Peringatan: Bahan baku ini memiliki {movementCount}{' '}
                    pergerakan stok yang akan ikut terhapus.
                  </span>
                  <br />
                  Tindakan ini tidak dapat dibatalkan dan akan menghapus semua
                  data terkait termasuk riwayat pergerakan stok.
                </>
              )}
              {movementCount === 0 && (
                <>
                  <br />
                  Tindakan ini tidak dapat dibatalkan.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
