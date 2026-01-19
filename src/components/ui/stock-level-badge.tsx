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
  const getBadge = () => {
    // Handle edge case where MOQ is 0 to prevent division by zero
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

  const getTooltipContent = () => {
    if (moq === 0) {
      return 'Tidak ada Minimum Order Quantity yang ditetapkan'
    }

    const percentage = Math.round((stock / moq) * 100)
    let action = ''

    if (percentage < 50) {
      action = ' - Segera pesan ulang!'
    } else if (percentage < 100) {
      action = ' - Persiapkan pemesanan.'
    }

    return `Stok (${stock.toLocaleString()}) adalah ${percentage}% dari MOQ (${moq.toLocaleString()})${action}`
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="cursor-help inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          {getBadge()}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{getTooltipContent()}</p>
      </TooltipContent>
    </Tooltip>
  )
}
