/**
 * Custom Hook: usePopoverState
 *
 * Manages popover open/close state for multiple popovers.
 * Useful for forms with multiple popover-based selectors.
 *
 * @param count - Number of popovers to manage (for array-based state)
 * @returns Object with popover state and handlers
 */

import { useState, useCallback } from 'react'

interface UsePopoverStateReturn {
  popoverOpen: Record<number, boolean>
  setPopoverOpen: (index: number, open: boolean) => void
  closePopover: (index: number) => void
  openPopover: (index: number) => void
  closeAll: () => void
}

/**
 * Single popover state management
 */
export function usePopoverState(): {
  open: boolean
  setOpen: (open: boolean) => void
} {
  const [open, setOpen] = useState(false)
  return { open, setOpen }
}

/**
 * Multiple popover state management (for field arrays)
 */
export function usePopoverStates(_count: number = 0): UsePopoverStateReturn {
  const [popoverOpen, setPopoverOpenState] = useState<Record<number, boolean>>(
    {}
  )

  const setPopoverOpen = useCallback((index: number, open: boolean) => {
    setPopoverOpenState((prev) => ({
      ...prev,
      [index]: open,
    }))
  }, [])

  const closePopover = useCallback(
    (index: number) => {
      setPopoverOpen(index, false)
    },
    [setPopoverOpen]
  )

  const openPopover = useCallback(
    (index: number) => {
      setPopoverOpen(index, true)
    },
    [setPopoverOpen]
  )

  const closeAll = useCallback(() => {
    setPopoverOpenState({})
  }, [])

  return {
    popoverOpen,
    setPopoverOpen,
    closePopover,
    openPopover,
    closeAll,
  }
}
