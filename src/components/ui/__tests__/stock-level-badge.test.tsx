// @vitest-environment happy-dom
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { StockLevelBadge } from '../stock-level-badge'
import { TooltipProvider } from '../tooltip'
import '@testing-library/jest-dom'

// Mock ResizeObserver for Radix UI
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('StockLevelBadge', () => {
  it('renders "Baik" status correctly', () => {
    render(
      <TooltipProvider>
        <StockLevelBadge stock={100} moq={50} />
      </TooltipProvider>
    )
    const badge = screen.getByText('Baik')
    expect(badge).toBeInTheDocument()
  })

  it('renders "Rendah" status correctly', () => {
    render(
      <TooltipProvider>
        <StockLevelBadge stock={6} moq={10} />
      </TooltipProvider>
    )
    const badge = screen.getByText('Rendah')
    expect(badge).toBeInTheDocument()
  })

  it('renders "Kritis" status correctly', () => {
    render(
      <TooltipProvider>
        <StockLevelBadge stock={2} moq={10} />
      </TooltipProvider>
    )
    const badge = screen.getByText('Kritis')
    expect(badge).toBeInTheDocument()
  })

  it('includes accessible tooltip trigger', () => {
    render(
      <TooltipProvider>
        <StockLevelBadge stock={50} moq={100} />
      </TooltipProvider>
    )

    // We expect a tab-focusable element wrapping the badge
    // Since we plan to use a span with tabIndex=0
    const trigger = screen.getByText('Rendah').closest('[tabindex="0"]')
    expect(trigger).toBeInTheDocument()
  })

  it('shows calculation details in tooltip trigger aria-label', () => {
    render(
      <TooltipProvider>
        <StockLevelBadge stock={50} moq={100} />
      </TooltipProvider>
    )

    // Verify the trigger exists and has the correct aria-label with calculation
    const trigger = screen.getByRole('button', { name: 'Status stok: 50% dari MOQ' })
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveAttribute('tabIndex', '0')
  })
})
