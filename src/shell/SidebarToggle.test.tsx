import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/ui/tooltip'
import { CollapsedChrome, SidebarToggle } from './SidebarToggle'

function renderWithTooltips(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

describe('SidebarToggle', () => {
  it('hides the sidebar from its top row, with the shortcut in its mono tooltip', async () => {
    const onToggle = vi.fn()
    renderWithTooltips(<SidebarToggle collapsed={false} onToggle={onToggle} />)

    const button = screen.getByRole('button', { name: 'Hide sidebar' })
    fireEvent.click(button)
    expect(onToggle).toHaveBeenCalledTimes(1)

    fireEvent.focus(button)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Hide sidebar ⌘[')
  })

  it('shows the sidebar again once collapsed', async () => {
    const onToggle = vi.fn()
    renderWithTooltips(<SidebarToggle collapsed onToggle={onToggle} />)

    const button = screen.getByRole('button', { name: 'Show sidebar' })
    fireEvent.focus(button)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Show sidebar ⌘[')
    fireEvent.click(button)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})

describe('CollapsedChrome', () => {
  it('leaves room for the traffic lights and puts the sidebar icon right after them', () => {
    renderWithTooltips(<CollapsedChrome onShowSidebar={vi.fn()} />)

    const chrome = screen.getByTestId('collapsed-chrome')
    const lights = screen.getByTestId('traffic-lights')
    const button = screen.getByRole('button', { name: 'Show sidebar' })
    expect(chrome).toContainElement(lights)
    expect(chrome).toContainElement(button)
    expect(lights.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
