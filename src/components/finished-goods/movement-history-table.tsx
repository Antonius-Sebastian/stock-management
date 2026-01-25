'use client'

import { useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { DataTable } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ArrowUpDown,
  CalendarIcon,
  MoreHorizontal,
  Edit,
  Trash2,
} from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { canEditStockMovements, canDeleteStockMovements } from '@/lib/rbac'
import { EditMovementDialog } from '@/components/stock/edit-movement-dialog'

interface Movement {
  id: string
  type: 'IN' | 'OUT' | 'ADJUSTMENT'
  quantity: number
  date: string
  description: string | null
  batch: { id: string; code: string } | null
  location: { id: string; name: string } | null
  runningBalance: number
  createdAt: string
}

interface MovementHistoryTableProps {
  movements: Movement[]
  onBatchClick?: (batchId: string) => void
  userRole?: string
  onRefresh?: () => void
}

export function FinishedGoodMovementHistoryTable({
  movements,
  onBatchClick,
  userRole,
  onRefresh,
}: MovementHistoryTableProps) {
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined)
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const canEdit = canEditStockMovements(userRole)
  const canDelete = canDeleteStockMovements(userRole)

  const handleEdit = (movement: Movement) => {
    setEditingMovement(movement)
    setEditDialogOpen(true)
  }

  const handleDelete = async (movement: Movement) => {
    // Prevent deleting batch movements
    if (movement.batch) {
      toast.error(
        'Tidak dapat menghapus pergerakan yang terkait dengan batch. Hapus batch terlebih dahulu.'
      )
      return
    }

    if (
      !confirm(
        `Apakah Anda yakin ingin menghapus pergerakan stok ini? Tindakan ini tidak dapat dibatalkan.`
      )
    ) {
      return
    }

    try {
      const response = await fetch(`/api/stock-movements/${movement.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to delete movement')
      }

      toast.success('Pergerakan stok berhasil dihapus')
      onRefresh?.()
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message || 'Gagal menghapus pergerakan stok')
      } else {
        toast.error('Gagal menghapus pergerakan stok')
      }
    }
  }

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
        const type = row.getValue('type') as 'IN' | 'OUT' | 'ADJUSTMENT'
        if (type === 'ADJUSTMENT') {
          const quantity = row.original.quantity
          const isPositive = quantity >= 0
          return (
            <Badge
              className={
                isPositive
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'bg-amber-200 text-amber-900 hover:bg-amber-300 dark:bg-amber-900/50 dark:text-amber-300'
              }
            >
              Penyesuaian
            </Badge>
          )
        }
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
        if (type === 'ADJUSTMENT') {
          // ADJUSTMENT can be positive or negative
          const isPositive = quantity >= 0
          return (
            <div
              className={`font-medium ${isPositive ? 'text-amber-600 dark:text-amber-400' : 'text-amber-700 dark:text-amber-500'}`}
            >
              {isPositive ? '+' : ''}
              {quantity.toLocaleString()}
            </div>
          )
        }
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
      id: 'location',
      header: 'Lokasi',
      cell: ({ row }) => {
        const location = row.original.location
        if (!location) {
          return <span className="text-muted-foreground">-</span>
        }
        return <span className="font-medium">{location.name}</span>
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
    ...(canEdit || canDelete
      ? [
          {
            id: 'actions',
            header: 'Aksi',
            cell: ({ row }) => {
              const movement = row.original
              const hasBatch = !!movement.batch

              // Don't show actions if user doesn't have permissions
              if (!canEdit && !canDelete) {
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
                    {canEdit && (
                      <DropdownMenuItem
                        onClick={() => handleEdit(movement)}
                        disabled={hasBatch}
                        title={
                          hasBatch
                            ? 'Tidak dapat mengedit pergerakan yang terkait dengan batch'
                            : undefined
                        }
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <>
                        {canEdit && <DropdownMenuSeparator />}
                        <DropdownMenuItem
                          onClick={() => handleDelete(movement)}
                          disabled={hasBatch}
                          className="text-destructive"
                          title={
                            hasBatch
                              ? 'Tidak dapat menghapus pergerakan yang terkait dengan batch'
                              : undefined
                          }
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
          } as ColumnDef<Movement>,
        ]
      : []),
  ]

  return (
    <>
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
          searchKeys={['description', 'batch.code', 'location.name']}
          searchPlaceholder="Cari berdasarkan lokasi atau batch..."
          emptyMessage="Belum ada pergerakan stok yang tercatat."
          tableId="finished-good-movement-history"
        />
      </div>
      {editingMovement && (
        <EditMovementDialog
          movement={{
            id: editingMovement.id,
            type: editingMovement.type,
            quantity: editingMovement.quantity,
            date: editingMovement.date,
            description: editingMovement.description,
            locationId: editingMovement.location?.id || null,
          }}
          itemType="finished-good"
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open)
            if (!open) {
              setEditingMovement(null)
            }
          }}
          onSuccess={() => {
            setEditDialogOpen(false)
            setEditingMovement(null)
            onRefresh?.()
          }}
        />
      )}
    </>
  )
}
