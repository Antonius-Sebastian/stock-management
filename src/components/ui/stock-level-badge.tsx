'use client'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface StockLevelBadgeProps {
  stock: number
  moq: number
}

export function StockLevelBadge({ stock, moq }: StockLevelBadgeProps) {
  // Common wrapper props for accessibility
  const triggerProps = {
    tabIndex: 0,
    className: cn(
      "cursor-help rounded-md outline-none",
      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    )
  }

  // Handle edge case where MOQ is 0 to prevent division by zero
  if (moq === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span {...triggerProps}>
            <Badge variant="outline" className="text-muted-foreground pointer-events-none">
              Tidak Ada MOQ
            </Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Tidak ada batasan minimal stok</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  const ratio = stock / moq
  const percentage = Math.round(ratio * 100)

  let badge
  if (ratio >= 1) {
    badge = (
      <Badge variant="success" className="font-semibold pointer-events-none">
        Baik
      </Badge>
    )
  } else if (ratio >= 0.5) {
    badge = (
      <Badge variant="warning" className="font-semibold pointer-events-none">
        Rendah
      </Badge>
    )
  } else {
    badge = (
      <Badge variant="destructive" className="font-semibold pointer-events-none">
        Kritis
      </Badge>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span {...triggerProps}>
          {badge}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1 text-center">
          <p className="font-semibold">Detail Stok</p>
          <div className="text-xs text-muted-foreground">
            <p>Stok: {stock.toLocaleString()}</p>
            <p>MOQ: {moq.toLocaleString()}</p>
          </div>
          <p className="pt-1 border-t text-xs font-medium">
            {percentage}% dari target
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
