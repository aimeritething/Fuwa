import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EmptyEditor } from './empty-editor'
import { TooltipProvider } from '@/ui/tooltip'

describe('EmptyEditor', () => {
  it('with no Folder open shows the dim wordmark and the one hint, Open Folder', () => {
    render(<EmptyEditor hasFolder={false} sidebarCollapsed={false} onShowSidebar={vi.fn()} />)

    const empty = screen.getByTestId('editor-empty-state')
    expect(empty).toHaveTextContent('Plumo')
    expect(screen.getAllByTestId('empty-hint').map((hint) => hint.textContent)).toEqual(['⌘OOpen Folder'])
  })

  it('with a Folder open and no Tab shows New document and Quick Open, each key a chip', () => {
    render(<EmptyEditor hasFolder sidebarCollapsed={false} onShowSidebar={vi.fn()} />)

    const hints = screen.getAllByTestId('empty-hint')
    expect(hints.map((hint) => hint.textContent)).toEqual(['⌘NNew document', '⌘PQuick Open'])
    expect(hints.map((hint) => hint.querySelector('kbd')?.textContent)).toEqual(['⌘N', '⌘P'])
  })

  it('keeps the way back to the sidebar on its top strip while collapsed', () => {
    const onShowSidebar = vi.fn()
    const { rerender } = render(
      <TooltipProvider><EmptyEditor hasFolder={false} sidebarCollapsed onShowSidebar={onShowSidebar} /></TooltipProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Show sidebar' }))
    expect(onShowSidebar).toHaveBeenCalledTimes(1)

    rerender(<TooltipProvider><EmptyEditor hasFolder={false} sidebarCollapsed={false} onShowSidebar={onShowSidebar} /></TooltipProvider>)
    expect(screen.queryByTestId('collapsed-chrome')).toBeNull()
  })
})
