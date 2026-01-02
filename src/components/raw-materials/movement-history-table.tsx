'use client'

import { useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { DataTable } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowUpDown, CalendarIcon } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'

interface Movement {
  id: string
  type: 'IN' | 'OUT'
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

export function MovementHistoryTable({
  movements,
  onBatchClick,
}: MovementHistoryTableProps) {
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined)

  // Filter movements by date if date filter is set
  const filteredMovements = dateFilter
    ? movements.filter((movement) => {
        const movementDate = new Date(movement.date)
        return (
          movementDate.getDate() === dateFilter.getDate() &&
          movementDate.getMonth() === dateFilter.getMonth() &&
          movementDate.getFullYear() === dateFilter.getFullYear()
        )
      })
    : movements

  const columns: ColumnDef<Movement>[] = [
    {
      accessorKey: 'date',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Tanggal
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const date = row.getValue('date') as string
        return format(new Date(date), 'MMM dd, yyyy')
      },
    },
    {
      accessorKey: 'type',
      header: 'Tipe',
      cell: ({ row }) => {
        const type = row.getValue('type') as 'IN' | 'OUT'
        return (
          <Badge variant={type === 'IN' ? 'default' : 'destructive'}>
            {type === 'IN' ? 'Stok Masuk' : 'Stok Keluar'}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'quantity',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Jumlah
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const quantity = row.getValue('quantity') as number
        const type = row.original.type
        return (
          <div
            className={`font-medium ${type === 'IN' ? 'text-green-600' : 'text-red-600'}`}
          >
            {type === 'IN' ? '+' : '-'}
            {quantity.toLocaleString()}
          </div>
        )
      },
    },
    {
      accessorKey: 'description',
      header: 'Deskripsi',
      cell: ({ row }) => {
        const description = row.getValue('description') as string | null
        return description || <span className="text-muted-foreground">-</span>
      },
    },
    {
      id: 'batch',
      header: 'Batch',
      cell: ({ row }) => {
        const batch = row.original.batch
        if (!batch) {
          return <span className="text-muted-foreground">-</span>
        }
        return (
          <button
            onClick={() => onBatchClick?.(batch.id)}
            className="text-primary cursor-pointer font-medium hover:underline"
          >
            {batch.code}
          </button>
        )
      },
    },
    {
      accessorKey: 'runningBalance',
      header: ({ column }) => {
        return (
          <div className="text-right">
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === 'asc')
              }
            >
              Saldo Berjalan
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )
      },
      cell: ({ row }) => {
        const balance = row.getValue('runningBalance') as number
        return (
          <div className="text-right font-semibold">
            {balance.toLocaleString()}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'justify-start text-left font-normal',
                !dateFilter && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFilter
                ? format(dateFilter, 'PPP')
                : 'Filter berdasarkan tanggal'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFilter}
              onSelect={setDateFilter}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {dateFilter && (
          <Button variant="ghost" onClick={() => setDateFilter(undefined)}>
            Hapus Filter
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        data={filteredMovements}
        searchKey="description"
        searchPlaceholder="Cari berdasarkan deskripsi..."
        emptyMessage="Belum ada pergerakan stok yang tercatat."
        tableId="movement-history"
      />
    </div>
  )
}
