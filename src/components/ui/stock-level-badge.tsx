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
  const percentage = moq > 0 ? Math.round((stock / moq) * 100) : 0

  let statusText = ''
  let variant: 'outline' | 'success' | 'warning' | 'destructive' = 'outline'
  let className = ''

  if (moq === 0) {
    statusText = 'Tidak Ada MOQ'
    variant = 'outline'
    className = 'text-muted-foreground'
  } else {
    const ratio = stock / moq
    if (ratio >= 1) {
      statusText = 'Baik'
      variant = 'success'
      className = 'font-semibold'
    } else if (ratio >= 0.5) {
      statusText = 'Rendah'
      variant = 'warning'
      className = 'font-semibold'
    } else {
      statusText = 'Kritis'
      variant = 'destructive'
      className = 'font-semibold'
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex cursor-help items-center gap-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          tabIndex={0}
          role="status"
          aria-label={`Status stok: ${statusText}. Stok: ${stock}, Minimum: ${moq} (${percentage}%)`}
        >
          <Badge variant={variant} className={className}>
            {statusText}
          </Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          Stok: {stock.toLocaleString('id-ID')} / MOQ:{' '}
          {moq.toLocaleString('id-ID')} ({percentage}%)
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
