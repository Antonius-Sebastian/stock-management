"use client"

import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import { RawMaterial } from "@prisma/client"
import { DataTable } from "@/components/ui/data-table"
import { StockLevelBadge } from "@/components/ui/stock-level-badge"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, MoreHorizontal, Edit, Trash2, ArrowDownCircle, Settings } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useState } from "react"
import { StockEntryDialog } from "@/components/stock/stock-entry-dialog"
import { StockAdjustmentDialog } from "@/components/stock/stock-adjustment-dialog"
import { canManageMaterials, canDeleteMaterials, canCreateStockMovement, canCreateStockAdjustment } from "@/lib/rbac"

interface RawMaterialsTableProps {
  data: RawMaterial[]
  onEdit?: (material: RawMaterial) => void
  onDelete?: (material: RawMaterial) => void
  onRefresh?: () => void
  userRole?: string
}

export function RawMaterialsTable({ data, onEdit, onDelete, onRefresh, userRole }: RawMaterialsTableProps) {
  const [stockDialogOpen, setStockDialogOpen] = useState(false)
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null)

  const handleStockIn = (material: RawMaterial) => {
    setSelectedMaterial(material)
    setStockDialogOpen(true)
  }

  const handleAdjustStock = (material: RawMaterial) => {
    setSelectedMaterial(material)
    setAdjustmentDialogOpen(true)
  }

  const handleStockSuccess = () => {
    setStockDialogOpen(false)
    setAdjustmentDialogOpen(false)
    setSelectedMaterial(null)
    onRefresh?.()
  }

  const columns: ColumnDef<RawMaterial>[] = [
    {
      accessorKey: "kode",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Kode
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
    },
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Nama Material
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const material = row.original
        return (
          <Link
            href={`/raw-materials/${material.id}`}
            className="text-primary hover:underline font-medium block overflow-hidden truncate max-w-md"
            title={material.name}
          >
            {material.name}
          </Link>
        )
      },
    },
    {
      accessorKey: "currentStock",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Stok Saat Ini
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const stock = row.getValue("currentStock") as number
        const moq = row.original.moq

        return (
          <div className="flex items-center gap-2">
            <span>{stock.toLocaleString()}</span>
            <StockLevelBadge stock={stock} moq={moq} />
          </div>
        )
      },
    },
    {
      accessorKey: "moq",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            MOQ
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const moq = row.getValue("moq") as number
        return <span>{moq.toLocaleString()}</span>
      },
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => {
        const material = row.original

        // Check if user has any permissions
        const hasEditPermission = canManageMaterials(userRole)
        const hasStockInPermission = canCreateStockMovement(userRole, 'raw-material', 'IN')
        const hasAdjustPermission = canCreateStockAdjustment(userRole)
        const hasDeletePermission = canDeleteMaterials(userRole)
        const hasAnyPermission = hasEditPermission || hasStockInPermission || hasAdjustPermission || hasDeletePermission

        // Don't show action button if no permissions
        if (!hasAnyPermission) {
          return null
        }

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Buka menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Aksi</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {hasEditPermission && (
                <DropdownMenuItem onClick={() => onEdit?.(material)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {hasStockInPermission && (
                <DropdownMenuItem onClick={() => handleStockIn(material)}>
                  <ArrowDownCircle className="mr-2 h-4 w-4" />
                  Input Stok Masuk
                </DropdownMenuItem>
              )}
              {hasAdjustPermission && (
                <DropdownMenuItem onClick={() => handleAdjustStock(material)}>
                  <Settings className="mr-2 h-4 w-4" />
                  Sesuaikan Stok
                </DropdownMenuItem>
              )}
              {hasDeletePermission && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete?.(material)}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Hapus
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        searchKeys={["name", "kode"]}
        searchPlaceholder="Cari bahan baku (nama atau kode)..."
        emptyMessage="Belum ada bahan baku. Klik 'Tambah Bahan Baku' untuk memulai!"
        tableId="raw-materials"
      />

      {selectedMaterial && (
        <>
          <StockEntryDialog
            open={stockDialogOpen}
            onOpenChange={setStockDialogOpen}
            type="in"
            entityType="raw-material"
            entityId={selectedMaterial.id}
            entityName={selectedMaterial.name}
            onSuccess={handleStockSuccess}
          />
          <StockAdjustmentDialog
            open={adjustmentDialogOpen}
            onOpenChange={setAdjustmentDialogOpen}
            itemType="raw-material"
            entityType="raw-material"
            entityId={selectedMaterial.id}
            entityName={selectedMaterial.name}
            onSuccess={handleStockSuccess}
          />
        </>
      )}
    </>
  )
}