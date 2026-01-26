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
  let badgeContent: React.ReactNode
  let tooltipText: string

  if (moq === 0) {
    tooltipText = `Stok: ${stock} (Tanpa MOQ)`
    badgeContent = (
      <Badge variant="outline" className="text-muted-foreground">
        Tidak Ada MOQ
      </Badge>
    )
  } else {
    const ratio = stock / moq
    const percentage = `${Math.round(ratio * 100)}%`
    tooltipText = `Stok: ${stock} / MOQ: ${moq} (${percentage})`

    if (ratio >= 1) {
      badgeContent = (
        <Badge variant="success" className="font-semibold">
          Baik
        </Badge>
      )
    } else if (ratio >= 0.5) {
      badgeContent = (
        <Badge variant="warning" className="font-semibold">
          Rendah
        </Badge>
      )
    } else {
      badgeContent = (
        <Badge variant="destructive" className="font-semibold">
          Kritis
        </Badge>
      )
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="inline-flex cursor-help rounded-md outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {badgeContent}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  )
}
