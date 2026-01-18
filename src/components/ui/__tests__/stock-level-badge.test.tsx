// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { StockLevelBadge } from '../stock-level-badge'
import { vi, describe, it, expect } from 'vitest'

// Mock Tooltip components to simplify testing
// We don't want to test Radix UI, just that we are using it correctly
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip">{children}</div>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode, asChild?: boolean }) => (
    <div data-testid="tooltip-trigger">{children}</div>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip-content">{children}</div>,
}))

// Mock Badge
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}))

describe('StockLevelBadge', () => {
  it('renders "Baik" when stock >= moq', () => {
    render(<StockLevelBadge stock={100} moq={100} />)
    const badge = screen.getByTestId('badge')
    expect(badge).toHaveTextContent('Baik')
    expect(badge).toHaveAttribute('data-variant', 'success')
  })

  it('renders "Rendah" when stock >= 50% moq', () => {
    render(<StockLevelBadge stock={50} moq={100} />)
    const badge = screen.getByTestId('badge')
    expect(badge).toHaveTextContent('Rendah')
    expect(badge).toHaveAttribute('data-variant', 'warning')
  })

  it('renders "Kritis" when stock < 50% moq', () => {
    render(<StockLevelBadge stock={49} moq={100} />)
    const badge = screen.getByTestId('badge')
    expect(badge).toHaveTextContent('Kritis')
    expect(badge).toHaveAttribute('data-variant', 'destructive')
  })

  it('renders tooltip content with percentage', () => {
    render(<StockLevelBadge stock={25} moq={100} />)

    // Check tooltip content
    const content = screen.getByTestId('tooltip-content')
    expect(content).toHaveTextContent('Stok: 25')
    expect(content).toHaveTextContent('MOQ: 100')
    expect(content).toHaveTextContent('25% dari target')
  })

  it('handles 0 MOQ correctly', () => {
    render(<StockLevelBadge stock={100} moq={0} />)
    const badge = screen.getByTestId('badge')
    expect(badge).toHaveTextContent('Tidak Ada MOQ')

    const content = screen.getByTestId('tooltip-content')
    expect(content).toHaveTextContent('Tidak ada batasan minimal stok')
  })
})
