"use client"

import { useMemo } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface StockReportData {
  id: string
  name: string
  code: string
  [key: string]: string | number // For dynamic day columns
}

interface StockReportTableProps {
  data: StockReportData[]
  daysInMonth: number
  currentDay: number
}

export function StockReportTable({ data, currentDay }: StockReportTableProps) {
  const dayColumns = useMemo(() => {
    return Array.from({ length: currentDay }, (_, i) => (i + 1).toString())
  }, [currentDay])

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
                <TableCell key={day} className="text-center">
                  {typeof item[day] === 'number' ? item[day].toLocaleString() : '-'}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}