"use client"

import { ColumnDef } from "@tanstack/react-table"
import { FinishedGood } from "@prisma/client"
import { DataTable } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { ArrowUpDown } from "lucide-react"

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
]

interface FinishedGoodsTableProps {
  data: FinishedGood[]
}

export function FinishedGoodsTable({ data }: FinishedGoodsTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search products..."
      emptyMessage="No finished goods yet. Click 'Add Finished Good' to get started!"
    />
  )
}