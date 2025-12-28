import { Badge } from "@/components/ui/badge"

interface StockLevelBadgeProps {
  stock: number
  moq: number
}

export function StockLevelBadge({ stock, moq }: StockLevelBadgeProps) {
  // Handle edge case where MOQ is 0 to prevent division by zero
  if (moq === 0) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        No MOQ Set
      </Badge>
    )
  }

  const ratio = stock / moq

  if (ratio >= 1) {
    return (
      <Badge className="bg-green-500 dark:bg-green-600 text-white hover:bg-green-600 dark:hover:bg-green-700">
        Good
      </Badge>
    )
  } else if (ratio >= 0.5) {
    return (
      <Badge variant="secondary" className="bg-yellow-500 dark:bg-yellow-600 text-white hover:bg-yellow-600 dark:hover:bg-yellow-700">
        Low
      </Badge>
    )
  } else {
    return (
      <Badge variant="destructive">
        Critical
      </Badge>
    )
  }
}