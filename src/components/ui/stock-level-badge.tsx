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
          <Badge
            variant="outline"
            className="text-muted-foreground cursor-help"
            tabIndex={0}
            role="status"
            aria-label="Status stok: Tidak ada MOQ"
          >
            Tidak Ada MOQ
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Minimum Order Quantity (MOQ) belum diatur</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  const ratio = stock / moq
  const percentage = Math.round(ratio * 100)

  let badgeElement
  if (ratio >= 1) {
    badgeElement = (
      <Badge
        variant="success"
        className="cursor-help font-semibold"
        tabIndex={0}
        role="status"
        aria-label={`Status stok: Baik (${percentage}% dari MOQ)`}
      >
        Baik
      </Badge>
    )
  } else if (ratio >= 0.5) {
    badgeElement = (
      <Badge
        variant="warning"
        className="cursor-help font-semibold"
        tabIndex={0}
        role="status"
        aria-label={`Status stok: Rendah (${percentage}% dari MOQ)`}
      >
        Rendah
      </Badge>
    )
  } else {
    badgeElement = (
      <Badge
        variant="destructive"
        className="cursor-help font-semibold"
        tabIndex={0}
        role="status"
        aria-label={`Status stok: Kritis (${percentage}% dari MOQ)`}
      >
        Kritis
      </Badge>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badgeElement}</TooltipTrigger>
      <TooltipContent className="flex flex-col gap-1">
        <div className="font-semibold">Detail Stok:</div>
        <div className="grid grid-cols-2 gap-x-4 text-xs">
          <span>Stok:</span>
          <span className="text-right font-medium">
            {stock.toLocaleString('id-ID')}
          </span>
          <span>MOQ:</span>
          <span className="text-right font-medium">
            {moq.toLocaleString('id-ID')}
          </span>
          <span>Persentase:</span>
          <span className="text-right font-medium">{percentage}%</span>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
