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
  const percentage = Math.round((stock / moq) * 100)

  let variant: 'success' | 'warning' | 'destructive'
  let label: string

  if (ratio >= 1) {
    variant = 'success'
    label = 'Baik'
  } else if (ratio >= 0.5) {
    variant = 'warning'
    label = 'Rendah'
  } else {
    variant = 'destructive'
    label = 'Kritis'
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="cursor-help rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Badge variant={variant} className="font-semibold">
            {label}
          </Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col gap-1">
          <p>Stok: {stock.toLocaleString()}</p>
          <p>MOQ: {moq.toLocaleString()}</p>
          <p className="font-medium">Persentase: {percentage}%</p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
