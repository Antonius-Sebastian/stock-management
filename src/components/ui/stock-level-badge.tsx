import { Badge } from '@/components/ui/badge'

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
