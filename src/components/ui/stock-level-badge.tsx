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
  if (moq === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="inline-flex cursor-default outline-none"
          >
            <Badge variant="outline" className="text-muted-foreground">
              Tidak Ada MOQ
            </Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Minimum Order Quantity (MOQ) belum diatur</p>
        </TooltipContent>
      </Tooltip>
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
          className="inline-flex cursor-help outline-none"
          role="status"
          aria-label={`Stok: ${stock}, MOQ: ${moq} (${percentage}%)`}
        >
          {badge}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">
          Stok: {stock.toLocaleString()} / MOQ: {moq.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground">
          ({percentage}% dari target)
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
