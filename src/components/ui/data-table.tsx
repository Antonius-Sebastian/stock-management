"use client"

import * as React from "react"
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
} from "@tanstack/react-table"
import { ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getColumnFilters, saveColumnFilters } from "@/lib/cookies"

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
  emptyMessage = "Tidak ada hasil.",
  tableId,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [globalFilter, setGlobalFilter] = React.useState("")

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
    (updater: VisibilityState | ((old: VisibilityState) => VisibilityState)) => {
      const newVisibility = typeof updater === 'function' ? updater(columnVisibility) : updater
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
    globalFilterFn: searchKeys ? (row, columnId, filterValue) => {
      const searchValue = String(filterValue).toLowerCase()
      return searchKeys.some(key => {
        const value = row.getValue(key)
        return String(value).toLowerCase().includes(searchValue)
      })
    } : undefined,
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
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center py-4">
        {searchKeys ? (
          <Input
            placeholder={searchPlaceholder || "Cari..."}
            value={globalFilter ?? ""}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="w-full sm:max-w-sm"
          />
        ) : searchKey ? (
          <Input
            placeholder={searchPlaceholder || "Cari..."}
            value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
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
      <div className="rounded-md border overflow-x-auto">
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
                  data-state={row.getIsSelected() && "selected"}
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
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between py-4">
        <div className="text-sm text-muted-foreground">
          Menampilkan {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} sampai{" "}
          {Math.min(
            (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
            table.getFilteredRowModel().rows.length
          )}{" "}
          dari {table.getFilteredRowModel().rows.length} entri
        </div>
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium whitespace-nowrap">Baris per halaman</p>
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => {
                table.setPageSize(Number(e.target.value))
              }}
              className="h-8 w-[70px] rounded-md border border-input bg-background px-2 text-sm"
            >
              {[10, 20, 30, 40, 50].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  {pageSize}
                </option>
              ))}
            </select>
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
            <div className="text-sm font-medium px-2 whitespace-nowrap">
              Hal. {table.getState().pagination.pageIndex + 1} dari{" "}
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