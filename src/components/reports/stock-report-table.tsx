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
import { cn } from '@/lib/utils'
import { BarChart3 } from 'lucide-react'

interface StockReportData {
  id: string
  name: string
  code: string
  [key: string]: string | number // For dynamic day columns
}

interface StockReportTableProps {
  data: StockReportData[]
  currentDay: number
  adjustments?: {
    [itemId: string]: {
      [day: string]: boolean
    }
  }
}

export function StockReportTable({
  data,
  currentDay,
  adjustments,
}: StockReportTableProps) {
  const dayColumns = useMemo(() => {
    return Array.from({ length: currentDay }, (_, i) => (i + 1).toString())
  }, [currentDay])

  // If no data, show simple empty state without scrollable columns
  if (data.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20">
        <div className="text-muted-foreground rounded-full bg-muted/50 p-3">
          <BarChart3 className="h-6 w-6" />
        </div>
        <div className="text-center">
          <p className="text-muted-foreground font-medium">
            Tidak ada data tersedia
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            Coba pilih periode lain atau filter yang berbeda
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full overflow-auto -mx-4 sm:mx-0 sm:rounded-md">
      <div className="inline-block min-w-full align-middle px-4 sm:px-0">
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-20 min-w-[200px] border-r-2 bg-card font-semibold shadow-[2px_0_4px_rgba(0,0,0,0.1)] dark:bg-slate-950 dark:shadow-[2px_0_4px_rgba(0,0,0,0.3)]">
                  Item
                </TableHead>
                {dayColumns.map((day) => (
                  <TableHead
                    key={day}
                    className="min-w-[80px] text-center font-semibold"
                  >
                    {day}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, rowIndex) => (
                <TableRow
                  key={item.id}
                  className="transition-colors duration-150 hover:bg-muted/50"
                >
                  <TableCell className="sticky left-0 z-10 border-r-2 bg-card font-medium shadow-[2px_0_4px_rgba(0,0,0,0.1)] dark:bg-slate-950 dark:shadow-[2px_0_4px_rgba(0,0,0,0.3)]">
                    <div>
                      <div className="font-semibold">{item.code}</div>
                      <div className="text-muted-foreground text-xs sm:text-sm">
                        {item.name}
                      </div>
                    </div>
                  </TableCell>
                  {dayColumns.map((day) => {
                    const value = item[day]
                    const numericValue = typeof value === 'number' ? value : 0
                    const hasValue = numericValue > 0
                    const isAdjustment =
                      adjustments?.[item.id]?.[day] === true

                    return (
                      <TableCell
                        key={day}
                        className={cn(
                          'text-center transition-colors duration-150',
                          hasValue &&
                            !isAdjustment &&
                            'bg-green-50/50 font-medium dark:bg-green-950/20',
                          hasValue &&
                            isAdjustment &&
                            'bg-amber-50/70 italic font-medium dark:bg-amber-950/30',
                          !hasValue && 'text-muted-foreground'
                        )}
                      >
                        {hasValue ? (
                          <>
                            {numericValue.toLocaleString('id-ID')}
                            {isAdjustment && (
                              <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">
                                *
                              </span>
                            )}
                          </>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      {/* Scroll indicator for mobile */}
      <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-background to-transparent sm:hidden" />
    </div>
  )
}
