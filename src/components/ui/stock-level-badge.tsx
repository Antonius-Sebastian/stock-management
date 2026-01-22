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
        <span tabIndex={0} className="cursor-help rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {badge}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>Stok saat ini: {percentage}% dari Minimum (MOQ)</p>
      </TooltipContent>
    </Tooltip>
  )
}
