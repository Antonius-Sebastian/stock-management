// @vitest-environment happy-dom
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { StockLevelBadge } from '../stock-level-badge'

describe('StockLevelBadge', () => {
  it('renders "Baik" when stock >= MOQ', () => {
    render(<StockLevelBadge stock={100} moq={100} />)
    expect(screen.getByText('Baik')).toBeInTheDocument()
  })

  it('renders "Rendah" when stock >= 50% MOQ', () => {
    render(<StockLevelBadge stock={50} moq={100} />)
    expect(screen.getByText('Rendah')).toBeInTheDocument()
  })

  it('renders "Kritis" when stock < 50% MOQ', () => {
    render(<StockLevelBadge stock={49} moq={100} />)
    expect(screen.getByText('Kritis')).toBeInTheDocument()
  })

  it('renders "Tidak Ada MOQ" when MOQ is 0', () => {
    render(<StockLevelBadge stock={10} moq={0} />)
    expect(screen.getByText('Tidak Ada MOQ')).toBeInTheDocument()
  })

  it('renders tooltip trigger with accessible attributes', () => {
    render(<StockLevelBadge stock={50} moq={100} />)
    const badge = screen.getByText('Rendah')
    // The badge text is inside the Badge component, which is inside the span trigger.
    const trigger = badge.closest('span[tabindex="0"]')
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveClass('cursor-help')
  })

  it('shows tooltip content on focus', async () => {
    render(<StockLevelBadge stock={50} moq={100} />)
    const badge = screen.getByText('Rendah')
    const trigger = badge.closest('span[tabindex="0"]')

    // Focus the trigger to open tooltip
    if (trigger) {
      fireEvent.focus(trigger)
    }

    // Radix UI Tooltip should render the content in a portal
    // We expect the detailed text to appear
    await waitFor(async () => {
        const elements = await screen.findAllByText('Stok: 50 / MOQ: 100 (50%)')
        expect(elements.length).toBeGreaterThan(0)
    })
  })
})
