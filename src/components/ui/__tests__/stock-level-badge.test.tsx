// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react'
import { StockLevelBadge } from '../stock-level-badge'
import { TooltipProvider } from '../tooltip'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

describe('StockLevelBadge', () => {
  it('renders "Baik" badge when stock >= moq', () => {
    render(
      <TooltipProvider>
        <StockLevelBadge stock={100} moq={100} />
      </TooltipProvider>
    )
    const badge = screen.getByText('Baik')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-green-500')
  })

  it('renders "Rendah" badge when stock is between 50% and 100% of moq', () => {
    render(
      <TooltipProvider>
        <StockLevelBadge stock={50} moq={100} />
      </TooltipProvider>
    )
    const badge = screen.getByText('Rendah')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-yellow-500')
  })

  it('renders "Kritis" badge when stock < 50% of moq', () => {
    render(
      <TooltipProvider>
        <StockLevelBadge stock={49} moq={100} />
      </TooltipProvider>
    )
    const badge = screen.getByText('Kritis')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-destructive')
  })

  it('renders tooltip with percentage on hover', async () => {
    const user = userEvent.setup()
    render(
      <TooltipProvider>
        <StockLevelBadge stock={120} moq={100} />
      </TooltipProvider>
    )

    const badge = screen.getByText('Baik')
    // Find the wrapper that triggers the tooltip
    const trigger = badge.closest('span[tabIndex="0"]') || badge.closest('button') || badge

    // Hover to trigger tooltip
    await user.hover(trigger)

    // Wait for tooltip content to appear
    const tooltipText = await screen.findByRole('tooltip')
    expect(tooltipText).toHaveTextContent('Stok saat ini: 120% dari Minimum (MOQ)')
  })

  it('handles edge case where MOQ is 0', async () => {
    render(
      <TooltipProvider>
        <StockLevelBadge stock={100} moq={0} />
      </TooltipProvider>
    )
    const badge = screen.getByText('Tidak Ada MOQ')
    expect(badge).toBeInTheDocument()
  })
})
