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
import { canManageFinishedGoods } from "@/lib/rbac"

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
          Product Name
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
          Current Stock
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
    header: "Actions",
    cell: ({ row }) => {
      const product = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {canManageFinishedGoods(userRole) && (
              <DropdownMenuItem onClick={() => onEdit?.(product)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => handleStockIn(product)}>
              <ArrowDownCircle className="mr-2 h-4 w-4" />
              Input Stock In
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStockOut(product)}>
              <ArrowUpCircle className="mr-2 h-4 w-4" />
              Input Stock Out
            </DropdownMenuItem>
            {canManageFinishedGoods(userRole) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete?.(product)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
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
        searchPlaceholder="Search products..."
        emptyMessage="No finished goods yet. Click 'Add Finished Good' to get started!"
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