"use client"

import { useMemo } from "react"
import { toast } from "sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EditableCell } from "./editable-cell"

interface StockReportData {
  id: string
  name: string
  code: string
  [key: string]: string | number // For dynamic day columns
}

interface StockReportTableProps {
  data: StockReportData[]
  currentDay: number
  dataType: string
  itemType: 'raw-material' | 'finished-good'
  year: number
  month: number
  onRefresh: () => void
}

export function StockReportTable({
  data,
  currentDay,
  dataType,
  itemType,
  year,
  month,
  onRefresh
}: StockReportTableProps) {
  const dayColumns = useMemo(() => {
    return Array.from({ length: currentDay }, (_, i) => (i + 1).toString())
  }, [currentDay])

  // Determine if cells are editable based on dataType
  const isEditable = dataType === 'stok-masuk' || dataType === 'stok-keluar'
  const movementType = dataType === 'stok-masuk' ? 'IN' : 'OUT'

  const handleSave = async (itemId: string, day: number, newValue: number) => {
    try {
      const date = new Date(year, month - 1, day)

      const response = await fetch('/api/stock-movements/by-date', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId,
          date: date.toISOString(),
          itemType,
          movementType,
          quantity: newValue,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to update stock movement')
      }

      toast.success('Stock movement updated successfully')
      onRefresh()
    } catch (error) {
      console.error('Error updating stock movement:', error)
      const message = error instanceof Error ? error.message : 'Failed to update stock movement'
      toast.error(message)
      throw error
    }
  }

  const handleDelete = async (itemId: string, day: number) => {
    try {
      const date = new Date(year, month - 1, day)

      const params = new URLSearchParams({
        itemId,
        date: date.toISOString(),
        itemType,
        movementType,
      })

      const response = await fetch(`/api/stock-movements/by-date?${params}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to delete stock movement')
      }

      toast.success('Stock movement deleted successfully')
      onRefresh()
    } catch (error) {
      console.error('Error deleting stock movement:', error)
      const message = error instanceof Error ? error.message : 'Failed to delete stock movement'
      toast.error(message)
      throw error
    }
  }

  // If no data, show simple empty state without scrollable columns
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No data available for the selected period.
      </div>
    )
  }

  return (
    <div className="w-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 bg-white border-r shadow-sm min-w-[200px]">
              Item
            </TableHead>
            {dayColumns.map((day) => (
              <TableHead key={day} className="text-center min-w-[80px]">
                {day}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="sticky left-0 z-10 bg-white border-r shadow-sm font-medium">
                <div>
                  <div className="font-medium">{item.code}</div>
                  <div className="text-sm text-muted-foreground">{item.name}</div>
                </div>
              </TableCell>
              {dayColumns.map((day) => (
                <TableCell key={day} className="p-0">
                  <EditableCell
                    value={item[day]}
                    isEditable={isEditable}
                    onSave={(newValue) => handleSave(item.id, parseInt(day), newValue)}
                    onDelete={isEditable ? () => handleDelete(item.id, parseInt(day)) : undefined}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}