/**
 * DatePickerField Component
 *
 * Reusable date picker field for forms with consistent styling.
 */

'use client'

import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface DatePickerFieldProps {
  value?: Date
  onChange: (date: Date | undefined) => void
  placeholder?: string
  disabled?: (date: Date) => boolean
  className?: string
}

export function DatePickerField({
  value,
  onChange,
  placeholder = 'Pilih tanggal',
  disabled,
  className,
}: DatePickerFieldProps) {
  const defaultDisabled = (date: Date) =>
    date > new Date() || date < new Date('1900-01-01')

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full pl-3 text-left font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          {value ? format(value, 'PPP') : <span>{placeholder}</span>}
          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          disabled={disabled || defaultDisabled}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
