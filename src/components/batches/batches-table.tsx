"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Batch, BatchUsage, RawMaterial, FinishedGood } from "@prisma/client"
import { DataTable } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { ArrowUpDown } from "lucide-react"
import { format } from "date-fns"

type BatchWithUsage = Batch & {
  finishedGood?: FinishedGood | null
  batchUsages: (BatchUsage & {
    rawMaterial: RawMaterial
  })[]
}

const columns: ColumnDef<BatchWithUsage>[] = [
  {
    accessorKey: "code",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Batch Code
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
          Date
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
    header: "Raw Materials Used",
    cell: ({ row }) => {
      const batch = row.original
      if (!batch.batchUsages.length) return "-"

      return (
        <div className="space-y-1">
          {batch.batchUsages.map((usage, index) => (
            <div key={index} className="text-sm">
              <span className="font-medium">{usage.rawMaterial.kode}</span>
              <span className="text-muted-foreground"> - {usage.quantity.toLocaleString()} units</span>
            </div>
          ))}
        </div>
      )
    },
  },
  {
    id: "output",
    header: "Finished Good",
    cell: ({ row }) => {
      const batch = row.original
      if (!batch.finishedGood) return "-"

      return (
        <div className="font-medium">{batch.finishedGood.name}</div>
      )
    },
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => {
      const description = row.getValue("description") as string
      return description || "-"
    },
  },
]

interface BatchesTableProps {
  data: BatchWithUsage[]
}

export function BatchesTable({ data }: BatchesTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="code"
      searchPlaceholder="Search batches..."
      emptyMessage="No batches recorded yet. Click 'Catat Pemakaian Baru' to record raw material usage!"
    />
  )
}