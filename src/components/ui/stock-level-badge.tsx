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
  const percentage = moq > 0 ? ((stock / moq) * 100).toFixed(1) : '0.0'

  const renderBadge = () => {
    if (moq === 0) {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Tidak Ada MOQ
        </Badge>
      )
    }

    const ratio = stock / moq

    if (ratio >= 1) {
      return (
        <Badge variant="success" className="font-semibold">
          Baik
        </Badge>
      )
    } else if (ratio >= 0.5) {
      return (
        <Badge variant="warning" className="font-semibold">
          Rendah
        </Badge>
      )
    } else {
      return (
        <Badge variant="destructive" className="font-semibold">
          Kritis
        </Badge>
      )
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Wrap in span to ensure focusability for keyboard users */}
        <span
          tabIndex={0}
          className="ring-offset-background focus-visible:ring-ring inline-flex cursor-help rounded-md outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          {renderBadge()}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col gap-1 text-xs">
          <p>Stok: {stock.toLocaleString()}</p>
          <p>MOQ: {moq.toLocaleString()}</p>
          {moq > 0 && (
            <p className="font-semibold">{percentage}% dari Target</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
