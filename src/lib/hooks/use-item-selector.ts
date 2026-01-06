/**
 * Custom Hook: useItemSelector
 *
 * Manages item selection with popover state and sorting logic.
 * Handles common patterns for selecting raw materials or finished goods.
 *
 * @param items - Array of items to select from
 * @param itemType - Type of item ('raw-material' | 'finished-good')
 * @returns Object with sorted items, popover state, and selection handlers
 */

import { useState, useMemo } from 'react'
import type { Item } from '@/lib/types'

interface UseItemSelectorOptions {
  items: Item[]
  itemType: 'raw-material' | 'finished-good'
}

interface UseItemSelectorReturn {
  sortedItems: Item[]
  itemsWithStock: Item[]
  itemsWithoutStock: Item[]
  popoverOpen: boolean
  setPopoverOpen: (open: boolean) => void
  handleSelect: (itemId: string, onSelect: (itemId: string) => void) => void
}

export function useItemSelector({
  items,
  itemType,
}: UseItemSelectorOptions): UseItemSelectorReturn {
  const [popoverOpen, setPopoverOpen] = useState(false)

  // Sort items: items with stock > 0 first, then items with stock = 0
  const { sortedItems, itemsWithStock, itemsWithoutStock } = useMemo(() => {
    const withStock = items
      .filter((item) => (item.currentStock ?? 0) > 0)
      .sort((a, b) => {
        if (itemType === 'raw-material') {
          const aKey = `${a.kode || ''} ${a.name || ''}`.trim()
          const bKey = `${b.kode || ''} ${b.name || ''}`.trim()
          return aKey.localeCompare(bKey)
        }
        return (a.name || '').localeCompare(b.name || '')
      })

    const withoutStock = items
      .filter((item) => (item.currentStock ?? 0) === 0)
      .sort((a, b) => {
        if (itemType === 'raw-material') {
          const aKey = `${a.kode || ''} ${a.name || ''}`.trim()
          const bKey = `${b.kode || ''} ${b.name || ''}`.trim()
          return aKey.localeCompare(bKey)
        }
        return (a.name || '').localeCompare(b.name || '')
      })

    return {
      sortedItems: [...withStock, ...withoutStock],
      itemsWithStock: withStock,
      itemsWithoutStock: withoutStock,
    }
  }, [items, itemType])

  const handleSelect = (itemId: string, onSelect: (itemId: string) => void) => {
    onSelect(itemId)
    setPopoverOpen(false)
  }

  return {
    sortedItems,
    itemsWithStock,
    itemsWithoutStock,
    popoverOpen,
    setPopoverOpen,
    handleSelect,
  }
}
