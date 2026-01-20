// @vitest-environment happy-dom

import { render, screen, fireEvent } from '@testing-library/react'
import { StockLevelBadge } from '../stock-level-badge'
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom'

// Mock ResizeObserver for Radix UI Tooltip
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('StockLevelBadge', () => {
  it('renders "Baik" badge when stock >= MOQ', () => {
    render(<StockLevelBadge stock={100} moq={100} />)
    expect(screen.getByText('Baik')).toBeInTheDocument()
  })

  it('renders "Rendah" badge when stock is between 50% and 100% of MOQ', () => {
    render(<StockLevelBadge stock={50} moq={100} />)
    expect(screen.getByText('Rendah')).toBeInTheDocument()
  })

  it('renders "Kritis" badge when stock is < 50% of MOQ', () => {
    render(<StockLevelBadge stock={49} moq={100} />)
    expect(screen.getByText('Kritis')).toBeInTheDocument()
  })

  it('renders "Tidak Ada MOQ" when MOQ is 0', () => {
    render(<StockLevelBadge stock={10} moq={0} />)
    expect(screen.getByText('Tidak Ada MOQ')).toBeInTheDocument()
  })

  it('shows tooltip details on focus for normal state', async () => {
    render(<StockLevelBadge stock={150} moq={100} />)

    const badge = screen.getByText('Baik')
    const trigger = badge.closest('span')

    expect(trigger).toBeInTheDocument()
    if (trigger) {
      fireEvent.focus(trigger)

      // Use findAllByText to handle async appearance and potential duplicate elements (Radix accessibility)
      const elements = await screen.findAllByText((content) => content.includes('Stok: 150 / MOQ: 100'))
      expect(elements.length).toBeGreaterThan(0)

      const percentageElements = await screen.findAllByText('(150% dari target)')
      expect(percentageElements.length).toBeGreaterThan(0)
    }
  })

  it('shows tooltip details on focus for MOQ=0 state', async () => {
    render(<StockLevelBadge stock={10} moq={0} />)

    const badge = screen.getByText('Tidak Ada MOQ')
    const trigger = badge.closest('span')

    expect(trigger).toBeInTheDocument()
    if (trigger) {
      fireEvent.focus(trigger)

      const elements = await screen.findAllByText('Minimum Order Quantity (MOQ) belum diatur')
      expect(elements.length).toBeGreaterThan(0)
    }
  })

  it('has accessible attributes', () => {
    render(<StockLevelBadge stock={50} moq={100} />)
    const trigger = screen.getByRole('status')
    expect(trigger).toHaveAttribute('aria-label', 'Stok: 50, MOQ: 100 (50%)')
    expect(trigger).toHaveAttribute('tabIndex', '0')
  })
})
