// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react'
import { StockLevelBadge } from '../stock-level-badge'
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom'

describe('StockLevelBadge', () => {
  it('renders "Baik" when stock >= MOQ', () => {
    render(<StockLevelBadge stock={100} moq={100} />)
    expect(screen.getByText('Baik')).toBeInTheDocument()
  })

  it('renders "Rendah" when stock >= 0.5 * MOQ', () => {
    render(<StockLevelBadge stock={50} moq={100} />)
    expect(screen.getByText('Rendah')).toBeInTheDocument()
  })

  it('renders "Kritis" when stock < 0.5 * MOQ', () => {
    render(<StockLevelBadge stock={40} moq={100} />)
    expect(screen.getByText('Kritis')).toBeInTheDocument()
  })

  it('shows tooltip with calculation details on hover', async () => {
    render(<StockLevelBadge stock={50} moq={100} />)

    const badgeText = screen.getByText('Rendah')
    // Find the focusable trigger wrapper
    const trigger = badgeText.closest('[tabindex="0"]') || badgeText

    fireEvent.focus(trigger)

    // Use findAllByText to handle potential duplicates (Radix often duplicates for a11y)
    // Radix UI Tooltip renders content twice: one visible, one for screen readers.
    // We use a flexible regex to handle potential whitespace issues.
    const elements = await screen.findAllByText(/Stok \(50\) adalah 50% dari MOQ \(100\)/)

    expect(elements.length).toBeGreaterThan(0)
    expect(elements[0]).toBeInTheDocument()
  })
})
