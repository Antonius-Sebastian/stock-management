/**
 * ItemSelector Component
 *
 * Reusable component for selecting raw materials or finished goods
 * with popover-based search and stock-aware sorting.
 */

'use client'

import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { useItemSelector } from '@/lib/hooks'
import type { Item } from '@/lib/types'

interface ItemSelectorProps {
  items: Item[]
  itemType: 'raw-material' | 'finished-good'
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  className?: string
}

export function ItemSelector({
  items,
  itemType,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  disabled = false,
  className,
}: ItemSelectorProps) {
  const {
    sortedItems,
    itemsWithStock,
    itemsWithoutStock,
    popoverOpen,
    setPopoverOpen,
    handleSelect,
  } = useItemSelector({ items, itemType })

  const selectedItem = sortedItems.find((item) => item.id === value)

  const displayValue = selectedItem
    ? itemType === 'raw-material'
      ? `${selectedItem.kode} - ${selectedItem.name}`
      : selectedItem.name
    : placeholder ||
      `Pilih ${itemType === 'raw-material' ? 'bahan baku' : 'produk jadi'}`

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn(
            'w-full min-w-0 justify-between overflow-hidden',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <span className="block min-w-0 truncate text-left">
            {displayValue}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder={
              searchPlaceholder ||
              `Cari ${itemType === 'raw-material' ? 'bahan baku' : 'produk jadi'}...`
            }
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>Tidak ada item yang ditemukan.</CommandEmpty>
            {itemsWithStock.length > 0 && (
              <CommandGroup heading="Tersedia">
                {itemsWithStock.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={
                      itemType === 'raw-material'
                        ? `${item.kode} ${item.name}`
                        : item.name
                    }
                    onSelect={() => handleSelect(item.id, onValueChange)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        item.id === value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                      <span className="block truncate">
                        {itemType === 'raw-material'
                          ? `${item.kode} - ${item.name}`
                          : item.name}
                      </span>
                      {item.currentStock !== undefined && (
                        <span className="shrink-0 text-xs font-medium whitespace-nowrap text-green-600">
                          (Stock: {item.currentStock.toLocaleString()})
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {itemsWithoutStock.length > 0 && (
              <CommandGroup heading="Stok Habis">
                {itemsWithoutStock.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={
                      itemType === 'raw-material'
                        ? `${item.kode} ${item.name}`
                        : item.name
                    }
                    onSelect={() => handleSelect(item.id, onValueChange)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        item.id === value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="block truncate">
                      {itemType === 'raw-material'
                        ? `${item.kode} - ${item.name}`
                        : item.name}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
