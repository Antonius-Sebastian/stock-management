// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react'
import { StockLevelBadge } from '../stock-level-badge'
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom'

describe('StockLevelBadge', () => {
  it('renders "Baik" and shows correct tooltip', async () => {
    render(<StockLevelBadge stock={100} moq={100} />)
    const badge = screen.getByText('Baik')
    expect(badge).toBeInTheDocument()

    // Find the trigger (parent span)
    const trigger = badge.closest('span[tabindex="0"]')
    expect(trigger).toBeInTheDocument()

    if (trigger) {
      fireEvent.focus(trigger)
      const tooltips = await screen.findAllByText('Stok aman (100% MOQ)')
      expect(tooltips.length).toBeGreaterThan(0)
    }
  })

  it('renders "Rendah" and shows correct tooltip', async () => {
    render(<StockLevelBadge stock={50} moq={100} />)
    expect(screen.getByText('Rendah')).toBeInTheDocument()

    const trigger = screen.getByText('Rendah').closest('span[tabindex="0"]')
    if (trigger) {
      fireEvent.focus(trigger)
      const tooltips = await screen.findAllByText('Stok menipis (50% MOQ)')
      expect(tooltips.length).toBeGreaterThan(0)
    }
  })

  it('renders "Kritis" and shows correct tooltip', async () => {
    render(<StockLevelBadge stock={40} moq={100} />)
    expect(screen.getByText('Kritis')).toBeInTheDocument()

    const trigger = screen.getByText('Kritis').closest('span[tabindex="0"]')
    if (trigger) {
      fireEvent.focus(trigger)
      const tooltips = await screen.findAllByText('Stok kritis (< 50% MOQ). Segera pesan!')
      expect(tooltips.length).toBeGreaterThan(0)
    }
  })

  it('renders "Tidak Ada MOQ" and shows correct tooltip', async () => {
    render(<StockLevelBadge stock={100} moq={0} />)
    expect(screen.getByText('Tidak Ada MOQ')).toBeInTheDocument()

    const trigger = screen.getByText('Tidak Ada MOQ').closest('span[tabindex="0"]')
    if (trigger) {
      fireEvent.focus(trigger)
      const tooltips = await screen.findAllByText('Tidak ada target stok (MOQ = 0)')
      expect(tooltips.length).toBeGreaterThan(0)
    }
  })
})
