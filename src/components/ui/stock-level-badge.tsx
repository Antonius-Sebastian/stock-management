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
          <span className="inline-flex cursor-help" tabIndex={0}>
            <Badge variant="outline" className="text-muted-foreground">
              Tidak Ada MOQ
            </Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex flex-col gap-1 text-xs">
            <div>
              Stok: <span className="font-mono">{stock.toLocaleString()}</span>
            </div>
            <div>
              MOQ: <span className="font-mono">0</span>
            </div>
          </div>
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
        <span className="inline-flex cursor-help" tabIndex={0}>
          {badge}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col gap-1 text-xs">
          <div>
            Stok: <span className="font-mono">{stock.toLocaleString()}</span>
          </div>
          <div>
            MOQ: <span className="font-mono">{moq.toLocaleString()}</span>
          </div>
          <div>
            Persentase: <span className="font-mono">{percentage}%</span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
