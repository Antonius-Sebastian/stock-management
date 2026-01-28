// @vitest-environment happy-dom
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { StockLevelBadge } from '../stock-level-badge'

// Mock Tooltip components to avoid Radix UI complexity in unit tests
// We want to test that OUR component passes the right props/content
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-trigger">{children}</div>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('StockLevelBadge', () => {
  it('renders "Baik" when stock >= moq', () => {
    render(<StockLevelBadge stock={100} moq={100} />)
    const badge = screen.getByText('Baik')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-green-500') // Check for success variant class roughly
  })

  it('renders "Rendah" when stock >= 0.5 * moq', () => {
    render(<StockLevelBadge stock={50} moq={100} />)
    expect(screen.getByText('Rendah')).toBeInTheDocument()
  })

  it('renders "Kritis" when stock < 0.5 * moq', () => {
    render(<StockLevelBadge stock={49} moq={100} />)
    expect(screen.getByText('Kritis')).toBeInTheDocument()
  })

  it('renders tooltip content with correct percentage', () => {
    render(<StockLevelBadge stock={75} moq={100} />)

    // Since we mocked TooltipContent to be always visible (for simplicity in verifying content existence),
    // we can check it directly.
    // In a real browser integration test, we would focus the trigger.
    // But here we just want to ensure the logic for the tooltip content is correct.

    // Note: The tooltip implementation is not yet done, so this test will fail initially or we expect it to fail.
    // But since we are creating the test BEFORE implementation (TDD), this is correct.

    // However, currently the component DOES NOT have the tooltip, so I should comment this out or expect it to fail?
    // I will write the test assuming the implementation is there.

    const tooltipContent = screen.getByTestId('tooltip-content')
    expect(tooltipContent).toHaveTextContent('Stok: 75')
    expect(tooltipContent).toHaveTextContent('MOQ: 100')
    expect(tooltipContent).toHaveTextContent('75.0%')
  })
})
