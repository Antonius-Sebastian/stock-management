"use client"

import { ColumnDef } from "@tanstack/react-table"
import { FinishedGood } from "@prisma/client"
import { DataTable } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, MoreHorizontal, Edit, Trash2, ArrowDownCircle, ArrowUpCircle } from "lucide-react"
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
import { canManageFinishedGoods, canDeleteFinishedGoods, canCreateStockMovement } from "@/lib/rbac"

interface FinishedGoodsTableProps {
  data: FinishedGood[]
  onEdit?: (product: FinishedGood) => void
  onDelete?: (product: FinishedGood) => void
  onRefresh?: () => void
  userRole?: string
}

export function FinishedGoodsTable({ data, onEdit, onDelete, onRefresh, userRole }: FinishedGoodsTableProps) {
  const [stockDialogOpen, setStockDialogOpen] = useState(false)
  const [stockDialogType, setStockDialogType] = useState<"in" | "out">("in")
  const [selectedProduct, setSelectedProduct] = useState<FinishedGood | null>(null)

  const handleStockIn = (product: FinishedGood) => {
    setSelectedProduct(product)
    setStockDialogType("in")
    setStockDialogOpen(true)
  }

  const handleStockOut = (product: FinishedGood) => {
    setSelectedProduct(product)
    setStockDialogType("out")
    setStockDialogOpen(true)
  }

  const handleStockSuccess = () => {
    setStockDialogOpen(false)
    setSelectedProduct(null)
    onRefresh?.()
  }

  const columns: ColumnDef<FinishedGood>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Nama Produk
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
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
      return <span>{stock.toLocaleString()}</span>
    },
  },
  {
    id: "actions",
    header: "Aksi",
    cell: ({ row }) => {
      const product = row.original

      // Check if user has any permissions
      const hasEditPermission = canManageFinishedGoods(userRole)
      const hasStockInPermission = canCreateStockMovement(userRole, 'finished-good', 'IN')
      const hasStockOutPermission = canCreateStockMovement(userRole, 'finished-good', 'OUT')
      const hasDeletePermission = canDeleteFinishedGoods(userRole)
      const hasAnyPermission = hasEditPermission || hasStockInPermission || hasStockOutPermission || hasDeletePermission

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
              <DropdownMenuItem onClick={() => onEdit?.(product)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}
            {hasStockInPermission && (
              <DropdownMenuItem onClick={() => handleStockIn(product)}>
                <ArrowDownCircle className="mr-2 h-4 w-4" />
                Input Stok Masuk
              </DropdownMenuItem>
            )}
            {hasStockOutPermission && (
              <DropdownMenuItem onClick={() => handleStockOut(product)}>
                <ArrowUpCircle className="mr-2 h-4 w-4" />
                Input Stok Keluar
              </DropdownMenuItem>
            )}
            {hasDeletePermission && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete?.(product)}
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
        searchKey="name"
        searchPlaceholder="Cari produk..."
        emptyMessage="Belum ada produk jadi. Klik 'Tambah Produk Jadi' untuk memulai!"
        tableId="finished-goods"
      />

      {selectedProduct && (
        <StockEntryDialog
          open={stockDialogOpen}
          onOpenChange={setStockDialogOpen}
          type={stockDialogType}
          entityType="finished-good"
          entityId={selectedProduct.id}
          entityName={selectedProduct.name}
          onSuccess={handleStockSuccess}
        />
      )}
    </>
  )
}