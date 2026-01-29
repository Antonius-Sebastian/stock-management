'use client'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface StockLevelBadgeProps {
  stock: number
  moq: number
}

export function StockLevelBadge({ stock, moq }: StockLevelBadgeProps) {
  // Handle edge case where MOQ is 0 to prevent division by zero
  if (moq === 0) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Tidak Ada MOQ
      </Badge>
    )
  }

  const ratio = stock / moq
  const percentage = Math.round(ratio * 100)

  let badge
  if (ratio >= 1) {
    badge = (
      <Badge variant="success" className="font-semibold">
        Baik
      </Badge>
    )
  } else if (ratio >= 0.5) {
    badge = (
      <Badge variant="warning" className="font-semibold">
        Rendah
      </Badge>
    )
  } else {
    badge = (
      <Badge variant="destructive" className="font-semibold">
        Kritis
      </Badge>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="ring-offset-background focus:ring-ring cursor-help inline-flex rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2"
          role="button"
          aria-label={`Status stok: ${percentage}% dari MOQ`}
        >
          {badge}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col gap-1 text-xs">
          <div className="flex justify-between gap-4">
            <span>Stok:</span>
            <span className="font-mono font-medium">
              {stock.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span>MOQ:</span>
            <span className="font-mono font-medium">
              {moq.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="bg-border my-0.5 h-px" />
          <div className="flex justify-between gap-4 font-semibold">
            <span>Persentase:</span>
            <span className="font-mono">{percentage}%</span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
