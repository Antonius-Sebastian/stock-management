'use client'

import { useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface StockReportData {
  id: string
  name: string
  code: string
  [key: string]: string | number // For dynamic day columns
}

interface StockReportTableProps {
  data: StockReportData[]
  currentDay: number
}

export function StockReportTable({ data, currentDay }: StockReportTableProps) {
  const dayColumns = useMemo(() => {
    return Array.from({ length: currentDay }, (_, i) => (i + 1).toString())
  }, [currentDay])

  // If no data, show simple empty state without scrollable columns
  if (data.length === 0) {
    return (
      <div className="text-muted-foreground flex h-64 items-center justify-center">
        No data available for the selected period.
      </div>
    )
  }

  return (
    <div className="w-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 min-w-[200px] border-r bg-white shadow-sm dark:bg-slate-950">
              Item
            </TableHead>
            {dayColumns.map((day) => (
              <TableHead key={day} className="min-w-[80px] text-center">
                {day}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="sticky left-0 z-10 border-r bg-white font-medium shadow-sm dark:bg-slate-950">
                <div>
                  <div className="font-medium">{item.code}</div>
                  <div className="text-muted-foreground text-sm">
                    {item.name}
                  </div>
                </div>
              </TableCell>
              {dayColumns.map((day) => {
                const value = item[day]
                const numericValue = typeof value === 'number' ? value : 0
                const hasValue = numericValue > 0

                return (
                  <TableCell key={day} className="text-center">
                    {hasValue ? numericValue.toLocaleString() : '-'}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
