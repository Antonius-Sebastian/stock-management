'use client'

import * as React from 'react'
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from '@tanstack/react-table'
import { ChevronDown, Package } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getColumnFilters, saveColumnFilters } from '@/lib/cookies'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchKey?: string
  searchKeys?: string[] // Multiple search keys
  searchPlaceholder?: string
  emptyMessage?: string
  tableId?: string // For persisting column visibility
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchKeys,
  searchPlaceholder,
  emptyMessage = 'Tidak ada hasil.',
  tableId,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [globalFilter, setGlobalFilter] = React.useState('')

  // Load column visibility from cookies on mount
  React.useEffect(() => {
    if (tableId) {
      const savedColumns = getColumnFilters(tableId)
      if (savedColumns.length > 0) {
        const visibility: VisibilityState = {}
        columns.forEach((col) => {
          const colDef = col as { accessorKey?: string; id?: string }
          const colId = colDef.accessorKey || colDef.id
          if (colId) {
            visibility[colId] = savedColumns.includes(colId)
          }
        })
        setColumnVisibility(visibility)
      }
    }
  }, [tableId, columns])

  // Save column visibility to cookies when it changes
  const handleColumnVisibilityChange = React.useCallback(
    (
      updater: VisibilityState | ((old: VisibilityState) => VisibilityState)
    ) => {
      const newVisibility =
        typeof updater === 'function' ? updater(columnVisibility) : updater
      setColumnVisibility(newVisibility)

      if (tableId) {
        const visibleColumns = Object.entries(newVisibility)
          .filter(([, isVisible]) => isVisible)
          .map(([colId]) => colId)
        saveColumnFilters(tableId, visibleColumns)
      }
    },
    [tableId, columnVisibility]
  )

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: handleColumnVisibilityChange,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: searchKeys
      ? (row, columnId, filterValue) => {
          const searchValue = String(filterValue).toLowerCase()
          return searchKeys.some((key) => {
            // Handle nested paths like "batch.code" or "drum.label"
            const keys = key.split('.')
            let value: any = row.original
            for (const k of keys) {
              value = value?.[k]
              if (value === null || value === undefined) break
            }
            // Handle null/undefined values
            if (value === null || value === undefined) {
              return false
            }
            return String(value).toLowerCase().includes(searchValue)
          })
        }
      : undefined,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
  })

  return (
    <div className="w-full">
      <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center">
        {searchKeys ? (
          <Input
            placeholder={searchPlaceholder || 'Cari...'}
            value={globalFilter ?? ''}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="w-full sm:max-w-sm"
          />
        ) : searchKey ? (
          <Input
            placeholder={searchPlaceholder || 'Cari...'}
            value={
              (table.getColumn(searchKey)?.getFilterValue() as string) ?? ''
            }
            onChange={(event) =>
              table.getColumn(searchKey)?.setFilterValue(event.target.value)
            }
            className="w-full sm:max-w-sm"
          />
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="sm:ml-auto">
              Kolom <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="relative -mx-4 overflow-x-auto sm:mx-0 sm:rounded-md">
        <div className="inline-block min-w-full align-middle px-4 sm:px-0">
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && 'selected'}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-32 text-center"
                    >
                      <div className="flex flex-col items-center justify-center gap-3 py-8">
                        <div className="text-muted-foreground rounded-full bg-muted/50 p-3">
                          <Package className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground font-medium">
                            {emptyMessage}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        {/* Scroll indicator for mobile */}
        <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-background to-transparent sm:hidden" />
      </div>
      <div className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-muted-foreground text-sm">
          Menampilkan{' '}
          {table.getState().pagination.pageIndex *
            table.getState().pagination.pageSize +
            1}{' '}
          sampai{' '}
          {Math.min(
            (table.getState().pagination.pageIndex + 1) *
              table.getState().pagination.pageSize,
            table.getFilteredRowModel().rows.length
          )}{' '}
          dari {table.getFilteredRowModel().rows.length} entri
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium whitespace-nowrap">
              Baris per halaman
            </p>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value))
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue
                  placeholder={table.getState().pagination.pageSize}
                />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className="hidden sm:flex"
            >
              Awal
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sm:hidden">&lt;</span>
              <span className="hidden sm:inline">Sebelumnya</span>
            </Button>
            <div className="px-2 text-sm font-medium whitespace-nowrap">
              Hal. {table.getState().pagination.pageIndex + 1} dari{' '}
              {table.getPageCount()}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sm:hidden">&gt;</span>
              <span className="hidden sm:inline">Berikutnya</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              className="hidden sm:flex"
            >
              Akhir
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
