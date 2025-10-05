"use client"

import { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { DataTable } from "@/components/ui/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUpDown } from "lucide-react"

interface Movement {
  id: string
  type: "IN" | "OUT"
  quantity: number
  date: string
  description: string | null
  batch: { id: string; code: string } | null
  runningBalance: number
  createdAt: string
}

interface MovementHistoryTableProps {
  movements: Movement[]
  onBatchClick?: (batchId: string) => void
}

export function MovementHistoryTable({ movements, onBatchClick }: MovementHistoryTableProps) {
  const columns: ColumnDef<Movement>[] = [
    {
      accessorKey: "date",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const date = row.getValue("date") as string
        return format(new Date(date), "MMM dd, yyyy")
      },
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue("type") as "IN" | "OUT"
        return (
          <Badge variant={type === "IN" ? "default" : "destructive"}>
            {type === "IN" ? "Stock In" : "Stock Out"}
          </Badge>
        )
      },
    },
    {
      accessorKey: "quantity",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Quantity
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const quantity = row.getValue("quantity") as number
        const type = row.original.type
        return (
          <div className={`font-medium ${type === "IN" ? "text-green-600" : "text-red-600"}`}>
            {type === "IN" ? "+" : "-"}
            {quantity.toLocaleString()}
          </div>
        )
      },
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => {
        const description = row.getValue("description") as string | null
        return description || <span className="text-muted-foreground">-</span>
      },
    },
    {
      id: "batch",
      header: "Batch",
      cell: ({ row }) => {
        const batch = row.original.batch
        if (!batch) {
          return <span className="text-muted-foreground">-</span>
        }
        return (
          <button
            onClick={() => onBatchClick?.(batch.id)}
            className="font-medium text-primary hover:underline cursor-pointer"
          >
            {batch.code}
          </button>
        )
      },
    },
    {
      accessorKey: "runningBalance",
      header: ({ column }) => {
        return (
          <div className="text-right">
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              Running Balance
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )
      },
      cell: ({ row }) => {
        const balance = row.getValue("runningBalance") as number
        return (
          <div className="text-right font-semibold">
            {balance.toLocaleString()}
          </div>
        )
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={movements}
      searchKey="description"
      searchPlaceholder="Search by description..."
      emptyMessage="No stock movements recorded yet."
    />
  )
}
