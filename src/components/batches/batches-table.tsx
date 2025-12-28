"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Batch, BatchUsage, RawMaterial, FinishedGood, BatchFinishedGood } from "@prisma/client"
import { DataTable } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, MoreHorizontal, Edit, Trash2, Eye } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { format } from "date-fns"
import { canEditBatches, canDeleteBatches } from "@/lib/rbac"

type BatchWithUsage = Batch & {
  batchFinishedGoods?: (BatchFinishedGood & {
    finishedGood: FinishedGood
  })[]
  batchUsages: (BatchUsage & {
    rawMaterial: RawMaterial
  })[]
}

interface BatchesTableProps {
  data: BatchWithUsage[]
  onView?: (batch: BatchWithUsage) => void
  onEdit?: (batch: BatchWithUsage) => void
  onDelete?: (batch: BatchWithUsage) => void
  userRole?: string
}

export function BatchesTable({ data, onView, onEdit, onDelete, userRole }: BatchesTableProps) {
  const columns: ColumnDef<BatchWithUsage>[] = [
  {
    accessorKey: "code",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Kode Batch
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
  },
  {
    accessorKey: "date",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Tanggal
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const date = row.getValue("date") as Date
      return format(new Date(date), "MMM dd, yyyy")
    },
  },
  {
    id: "materials",
    header: "Bahan Baku Digunakan",
    cell: ({ row }) => {
      const batch = row.original
      if (!batch.batchUsages.length) return "-"

      return (
        <div className="space-y-1 max-w-xs">
          {batch.batchUsages.map((usage, index) => (
            <div key={index} className="text-sm truncate" title={`${usage.rawMaterial.kode} - ${usage.quantity.toLocaleString()} unit`}>
              <span className="font-medium">{usage.rawMaterial.kode}</span>
              <span className="text-muted-foreground"> - {usage.quantity.toLocaleString()} unit</span>
            </div>
          ))}
        </div>
      )
    },
  },
  {
    id: "output",
    header: "Produk Jadi",
    cell: ({ row }) => {
      const batch = row.original
      if (!batch.batchFinishedGoods || batch.batchFinishedGoods.length === 0) return "-"

      return (
        <div className="space-y-1 max-w-xs">
          {batch.batchFinishedGoods.map((bfg, index) => (
            <div key={index} className="text-sm truncate" title={`${bfg.finishedGood.name} - ${bfg.quantity.toLocaleString()} unit`}>
              <span className="font-medium">{bfg.finishedGood.name}</span>
              <span className="text-muted-foreground"> - {bfg.quantity.toLocaleString()} unit</span>
            </div>
          ))}
        </div>
      )
    },
  },
  {
    accessorKey: "description",
    header: "Deskripsi",
    cell: ({ row }) => {
      const description = row.getValue("description") as string
      return (
        <div className="max-w-xs truncate" title={description || undefined}>
          {description || "-"}
        </div>
      )
    },
  },
  {
    id: "actions",
    header: "Aksi",
    cell: ({ row }) => {
      const batch = row.original

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
            <DropdownMenuItem onClick={() => onView?.(batch)}>
              <Eye className="mr-2 h-4 w-4" />
              Lihat Detail
            </DropdownMenuItem>
            {canEditBatches(userRole) && (
              <DropdownMenuItem onClick={() => onEdit?.(batch)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}
            {canDeleteBatches(userRole) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete?.(batch)}
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
    <DataTable
      columns={columns}
      data={data}
      searchKey="code"
      searchPlaceholder="Cari batch..."
      emptyMessage="Belum ada batch tercatat. Klik 'Catat Pemakaian Baru' untuk mencatat penggunaan bahan baku!"
      tableId="batches"
    />
  )
}