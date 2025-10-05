"use client"

import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import { RawMaterial } from "@prisma/client"
import { DataTable } from "@/components/ui/data-table"
import { StockLevelBadge } from "@/components/ui/stock-level-badge"
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
import { canManageMaterials } from "@/lib/rbac"

interface RawMaterialsTableProps {
  data: RawMaterial[]
  onEdit?: (material: RawMaterial) => void
  onDelete?: (material: RawMaterial) => void
  onRefresh?: () => void
  userRole?: string
}

export function RawMaterialsTable({ data, onEdit, onDelete, onRefresh, userRole }: RawMaterialsTableProps) {
  const [stockDialogOpen, setStockDialogOpen] = useState(false)
  const [stockDialogType, setStockDialogType] = useState<"in" | "out">("in")
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null)

  const handleStockIn = (material: RawMaterial) => {
    setSelectedMaterial(material)
    setStockDialogType("in")
    setStockDialogOpen(true)
  }

  const handleStockOut = (material: RawMaterial) => {
    setSelectedMaterial(material)
    setStockDialogType("out")
    setStockDialogOpen(true)
  }

  const handleStockSuccess = () => {
    setStockDialogOpen(false)
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
            Code
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
            Material Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const material = row.original
        return (
          <Link
            href={`/raw-materials/${material.id}`}
            className="text-primary hover:underline font-medium"
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
            Current Stock
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
      header: "Actions",
      cell: ({ row }) => {
        const material = row.original

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
              {canManageMaterials(userRole) && (
                <DropdownMenuItem onClick={() => onEdit?.(material)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => handleStockIn(material)}>
                <ArrowDownCircle className="mr-2 h-4 w-4" />
                Input Stock In
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStockOut(material)}>
                <ArrowUpCircle className="mr-2 h-4 w-4" />
                Input Stock Out
              </DropdownMenuItem>
              {canManageMaterials(userRole) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete?.(material)}
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
        searchPlaceholder="Search materials..."
        emptyMessage="No raw materials yet. Click 'Add Raw Material' to get started!"
      />

      {selectedMaterial && (
        <StockEntryDialog
          open={stockDialogOpen}
          onOpenChange={setStockDialogOpen}
          type={stockDialogType}
          entityType="raw-material"
          entityId={selectedMaterial.id}
          entityName={selectedMaterial.name}
          onSuccess={handleStockSuccess}
        />
      )}
    </>
  )
}