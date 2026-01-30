// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import { StockLevelBadge } from '../stock-level-badge'
import { describe, it, expect, vi } from 'vitest'
import React from 'react'

// Mock Tooltip components to avoid Radix UI rendering issues in test environment
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children, _asChild }: { children: React.ReactNode; _asChild?: boolean }) => (
    <div data-testid="tooltip-trigger">{children}</div>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip-content">{children}</div>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe('StockLevelBadge', () => {
  it('renders with correct status text', () => {
    const { rerender } = render(<StockLevelBadge stock={100} moq={50} />)
    expect(screen.getByText('Baik')).toBeDefined()

    rerender(<StockLevelBadge stock={30} moq={50} />)
    expect(screen.getByText('Rendah')).toBeDefined()

    rerender(<StockLevelBadge stock={10} moq={50} />)
    expect(screen.getByText('Kritis')).toBeDefined()
  })

  it('renders "Tidak Ada MOQ" when moq is 0', () => {
    render(<StockLevelBadge stock={100} moq={0} />)
    expect(screen.getByText('Tidak Ada MOQ')).toBeDefined()
  })

  it('renders tooltip with correct detailed information', () => {
    render(<StockLevelBadge stock={100} moq={50} />)

    // Check if tooltip content is rendered (via mock)
    const content = screen.getByTestId('tooltip-content')
    expect(content.textContent).toContain('Stok: 100')
    expect(content.textContent).toContain('MOQ: 50')
    expect(content.textContent).toContain('(200%)')
  })

  it('formats percentage correctly', () => {
    render(<StockLevelBadge stock={25} moq={50} />)
    const content = screen.getByTestId('tooltip-content')
    expect(content.textContent).toContain('(50%)')
  })
})
