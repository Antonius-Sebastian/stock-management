"use client"

import { ColumnDef } from "@tanstack/react-table"
import { RawMaterial } from "@prisma/client"
import { DataTable } from "@/components/ui/data-table"
import { StockLevelBadge } from "@/components/ui/stock-level-badge"
import { Button } from "@/components/ui/button"
import { ArrowUpDown } from "lucide-react"

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
]

interface RawMaterialsTableProps {
  data: RawMaterial[]
}

export function RawMaterialsTable({ data }: RawMaterialsTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search materials..."
      emptyMessage="No raw materials yet. Click 'Add Raw Material' to get started!"
    />
  )
}