// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react'
import { StockLevelBadge } from '../stock-level-badge'
import '@testing-library/jest-dom'
import { describe, it, expect } from 'vitest'

describe('StockLevelBadge', () => {
  it('renders "Baik" when stock >= MOQ', () => {
    render(<StockLevelBadge stock={100} moq={100} />)
    const badge = screen.getByText('Baik')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-green-500')
  })

  it('renders "Rendah" when stock >= 50% MOQ', () => {
    render(<StockLevelBadge stock={50} moq={100} />)
    const badge = screen.getByText('Rendah')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-yellow-500')
  })

  it('renders "Kritis" when stock < 50% MOQ', () => {
    render(<StockLevelBadge stock={40} moq={100} />)
    const badge = screen.getByText('Kritis')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-destructive')
  })

  it('renders "Tidak Ada MOQ" when MOQ is 0', () => {
    render(<StockLevelBadge stock={100} moq={0} />)
    const badge = screen.getByText('Tidak Ada MOQ')
    expect(badge).toBeInTheDocument()
  })

  it('shows tooltip with percentage calculation on hover', async () => {
    render(<StockLevelBadge stock={150} moq={100} />)

    const badge = screen.getByText('Baik')
    // The trigger is the parent span of the badge
    const trigger = badge.closest('span')

    // Check if trigger exists and focus it (simulating hover/focus)
    expect(trigger).toBeInTheDocument()
    if (!trigger) throw new Error('Trigger not found')

    // Simulate focus to trigger tooltip
    fireEvent.focus(trigger)

    // Tooltip content should appear
    // Use getAllByText because Radix Tooltip might duplicate content for accessibility
    const tooltipTexts = await screen.findAllByText(/Stok \(150\) adalah 150% dari MOQ \(100\)/)
    expect(tooltipTexts.length).toBeGreaterThan(0)
    expect(tooltipTexts[0]).toBeInTheDocument()
  })

  it('shows urgent message in tooltip when stock is critical', async () => {
    render(<StockLevelBadge stock={40} moq={100} />)

    const badge = screen.getByText('Kritis')
    const trigger = badge.closest('span')

    expect(trigger).toBeInTheDocument()
    if (!trigger) throw new Error('Trigger not found')

    fireEvent.focus(trigger)

    // "Stok (40) adalah 40% dari MOQ (100) - Segera pesan ulang!"
    const tooltipTexts = await screen.findAllByText(/Segera pesan ulang!/)
    expect(tooltipTexts.length).toBeGreaterThan(0)
    expect(tooltipTexts[0]).toBeInTheDocument()
  })
})
