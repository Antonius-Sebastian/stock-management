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
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="cursor-help inline-flex">
            <Badge variant="outline" className="text-muted-foreground">
              Tidak Ada MOQ
            </Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Tidak ada target stok (MOQ = 0)</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  const ratio = stock / moq
  let badge
  let message

  if (ratio >= 1) {
    badge = (
      <Badge variant="success" className="font-semibold">
        Baik
      </Badge>
    )
    message = `Stok aman (${Math.round(ratio * 100)}% MOQ)`
  } else if (ratio >= 0.5) {
    badge = (
      <Badge variant="warning" className="font-semibold">
        Rendah
      </Badge>
    )
    message = `Stok menipis (${Math.round(ratio * 100)}% MOQ)`
  } else {
    badge = (
      <Badge variant="destructive" className="font-semibold">
        Kritis
      </Badge>
    )
    message = `Stok kritis (< 50% MOQ). Segera pesan!`
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="cursor-help inline-flex">
          {badge}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{message}</p>
      </TooltipContent>
    </Tooltip>
  )
}
