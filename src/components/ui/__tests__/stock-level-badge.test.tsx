// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react'
import { StockLevelBadge } from '../stock-level-badge'
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock the Tooltip components to avoid Radix UI + happy-dom interaction issues
// This ensures we test OUR logic (rendering the correct data) rather than Radix's behavior
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip">{children}</div>
  ),
  TooltipTrigger: ({
    children,
  }: {
    children: React.ReactNode
    asChild?: boolean
  }) => <div data-testid="tooltip-trigger">{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

describe('StockLevelBadge', () => {
  it('renders badge with correct status "Baik"', () => {
    render(<StockLevelBadge stock={100} moq={50} />)
    expect(screen.getByText('Baik')).toBeInTheDocument()
  })

  it('renders badge with correct status "Rendah"', () => {
    render(<StockLevelBadge stock={50} moq={100} />)
    expect(screen.getByText('Rendah')).toBeInTheDocument()
  })

  it('renders badge with correct status "Kritis"', () => {
    render(<StockLevelBadge stock={10} moq={100} />)
    expect(screen.getByText('Kritis')).toBeInTheDocument()
  })

  it('renders badge with correct status when MOQ is 0', () => {
    render(<StockLevelBadge stock={10} moq={0} />)
    expect(screen.getByText('Tidak Ada MOQ')).toBeInTheDocument()
  })

  it('renders tooltip content with correct details', () => {
    render(<StockLevelBadge stock={50} moq={100} />)

    // Check if tooltip structure is present
    expect(screen.getByTestId('tooltip')).toBeInTheDocument()
    expect(screen.getByTestId('tooltip-trigger')).toBeInTheDocument()

    // Check content (since we mocked it to always render, we don't need hover)
    expect(screen.getByTestId('tooltip-content')).toHaveTextContent(
      /Stok: 50 \| MOQ: 100 \(50%\)/
    )
  })

  it('renders tooltip content correctly for > 100%', () => {
    render(<StockLevelBadge stock={200} moq={100} />)
    expect(screen.getByTestId('tooltip-content')).toHaveTextContent(
      /Stok: 200 \| MOQ: 100 \(200%\)/
    )
  })
})
