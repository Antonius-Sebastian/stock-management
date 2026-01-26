// @vitest-environment happy-dom
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { StockLevelBadge } from '../stock-level-badge'
import { vi } from 'vitest'

// Mock the Tooltip components to avoid testing Radix UI internals
// and verify that our component renders the correct content structure.
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip">{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip-trigger">{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip-content">{children}</div>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe('StockLevelBadge', () => {
  it('renders correct status based on ratio', () => {
    const { unmount } = render(<StockLevelBadge stock={100} moq={50} />)
    expect(screen.getByText('Baik')).toBeInTheDocument()
    unmount()

    render(<StockLevelBadge stock={30} moq={50} />)
    expect(screen.getByText('Rendah')).toBeInTheDocument()
  })

  it('renders tooltip content with correct details', () => {
    render(<StockLevelBadge stock={100} moq={50} />)

    // Check if tooltip content is present (since we mocked it to be always rendered)
    const content = screen.getByTestId('tooltip-content')
    expect(content).toHaveTextContent('Stok: 100')
    expect(content).toHaveTextContent('MOQ: 50')
    expect(content).toHaveTextContent('Persentase: 200%')
  })

  it('renders correct tooltip for No MOQ', () => {
    render(<StockLevelBadge stock={10} moq={0} />)
    expect(screen.getByText('Tidak Ada MOQ')).toBeInTheDocument()

    const content = screen.getByTestId('tooltip-content')
    expect(content).toHaveTextContent('Stok: 10')
    expect(content).toHaveTextContent('MOQ: 0')
    expect(content).not.toHaveTextContent('Persentase:')
  })
})
