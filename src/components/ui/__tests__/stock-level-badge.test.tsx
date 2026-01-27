// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { StockLevelBadge } from '../stock-level-badge'
import '@testing-library/jest-dom'
import React from 'react'

// Mock Tooltip components to avoid Radix UI issues in happy-dom
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

// Mock Badge to check variant
vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    variant,
    className,
  }: {
    children: React.ReactNode
    variant: string
    className?: string
  }) => (
    <div data-testid="badge" data-variant={variant} className={className}>
      {children}
    </div>
  ),
}))

describe('StockLevelBadge', () => {
  it('renders "Baik" when stock >= MOQ', () => {
    render(<StockLevelBadge stock={100} moq={100} />)
    const badge = screen.getByTestId('badge')
    expect(badge).toHaveTextContent('Baik')
    expect(badge).toHaveAttribute('data-variant', 'success')
  })

  it('renders "Rendah" when stock is between 50% and 100% of MOQ', () => {
    render(<StockLevelBadge stock={50} moq={100} />)
    const badge = screen.getByTestId('badge')
    expect(badge).toHaveTextContent('Rendah')
    expect(badge).toHaveAttribute('data-variant', 'warning')
  })

  it('renders "Kritis" when stock < 50% of MOQ', () => {
    render(<StockLevelBadge stock={49} moq={100} />)
    const badge = screen.getByTestId('badge')
    expect(badge).toHaveTextContent('Kritis')
    expect(badge).toHaveAttribute('data-variant', 'destructive')
  })

  it('renders "Tidak Ada MOQ" when MOQ is 0', () => {
    render(<StockLevelBadge stock={100} moq={0} />)
    const badge = screen.getByTestId('badge')
    expect(badge).toHaveTextContent('Tidak Ada MOQ')
    expect(badge).toHaveAttribute('data-variant', 'outline')
  })

  it('renders tooltip content with correct calculations', () => {
    render(<StockLevelBadge stock={75} moq={100} />)

    // Check if TooltipTrigger is present
    const trigger = screen.getByTestId('tooltip-trigger')
    expect(trigger).toBeInTheDocument()

    // Check tooltip content
    const content = screen.getByTestId('tooltip-content')
    expect(content).toHaveTextContent('Stok: 75')
    expect(content).toHaveTextContent('MOQ: 100')
    expect(content).toHaveTextContent('Persentase: 75%')
  })

  it('calculates percentage correctly', () => {
     render(<StockLevelBadge stock={1} moq={3} />) // 33.33% -> 33%
     const content = screen.getByTestId('tooltip-content')
     expect(content).toHaveTextContent('Persentase: 33%')
  })
})
