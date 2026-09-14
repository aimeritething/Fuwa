import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Sidebar } from './sidebar'
import { TooltipProvider } from '@/ui/tooltip'

function renderSidebar(width: number, onWidthChange = vi.fn(), onToggle = vi.fn()) {
  render(
    <TooltipProvider>
      <Sidebar width={width} onWidthChange={onWidthChange} onToggle={onToggle}><div>rows</div></Sidebar>
    </TooltipProvider>,
  )
  return { onWidthChange, onToggle }
}

describe('Sidebar', () => {
  it('is as wide as the Session says and collapses from the icon on its top row', () => {
    const { onToggle } = renderSidebar(300)

    expect(screen.getByTestId('sidebar').style.getPropertyValue('--fuwa-sidebar-width')).toBe('300px')
    fireEvent.click(screen.getByRole('button', { name: 'Hide sidebar' }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('follows the pointer while its edge is dragged and reports the width once at release', () => {
    const { onWidthChange } = renderSidebar(260)
    const edge = screen.getByRole('separator', { name: 'Resize sidebar' })

    fireEvent.pointerDown(edge, { pointerId: 1, clientX: 260, button: 0 })
    fireEvent.pointerMove(edge, { pointerId: 1, clientX: 300 })
    expect(screen.getByTestId('sidebar').style.getPropertyValue('--fuwa-sidebar-width')).toBe('300px')
    expect(onWidthChange).not.toHaveBeenCalled()
    fireEvent.pointerMove(edge, { pointerId: 1, clientX: 340 })
    fireEvent.pointerUp(edge, { pointerId: 1, clientX: 340 })

    expect(onWidthChange).toHaveBeenCalledExactlyOnceWith(340)
  })

  it('stays inside the sidebar range while dragged', () => {
    renderSidebar(260)
    const edge = screen.getByRole('separator', { name: 'Resize sidebar' })

    fireEvent.pointerDown(edge, { pointerId: 1, clientX: 260, button: 0 })
    fireEvent.pointerMove(edge, { pointerId: 1, clientX: 900 })
    expect(screen.getByTestId('sidebar').style.getPropertyValue('--fuwa-sidebar-width')).toBe('480px')
  })

  it('resizes by keyboard from the edge as well', () => {
    const { onWidthChange } = renderSidebar(260)
    const edge = screen.getByRole('separator', { name: 'Resize sidebar' })

    fireEvent.keyDown(edge, { key: 'ArrowRight' })
    expect(onWidthChange).toHaveBeenCalledWith(276)
    fireEvent.keyDown(edge, { key: 'ArrowLeft' })
    expect(onWidthChange).toHaveBeenCalledWith(244)
  })
})
