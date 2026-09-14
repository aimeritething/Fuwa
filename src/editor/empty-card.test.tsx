import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EmptyCard } from './empty-card'
import { TooltipProvider } from '@/ui/tooltip'

describe('EmptyCard', () => {
  it('with no Folder open shows the dim wordmark and the one hint, open folder', () => {
    render(<EmptyCard hasFolder={false} sidebarCollapsed={false} onShowSidebar={vi.fn()} />)

    const card = screen.getByTestId('editor-empty-state')
    expect(card).toHaveTextContent('Fuwa')
    expect(screen.getAllByTestId('empty-hint').map((hint) => hint.textContent)).toEqual(['⌘Oopen folder'])
  })

  it('with a Folder open and no Tab shows new document and quick open', () => {
    render(<EmptyCard hasFolder sidebarCollapsed={false} onShowSidebar={vi.fn()} />)

    expect(screen.getAllByTestId('empty-hint').map((hint) => hint.textContent)).toEqual(['⌘Nnew document', '⌘Pquick open'])
  })

  it('keeps the way back to the sidebar on its top strip while collapsed', () => {
    const onShowSidebar = vi.fn()
    const { rerender } = render(
      <TooltipProvider><EmptyCard hasFolder={false} sidebarCollapsed onShowSidebar={onShowSidebar} /></TooltipProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Show sidebar' }))
    expect(onShowSidebar).toHaveBeenCalledTimes(1)

    rerender(<TooltipProvider><EmptyCard hasFolder={false} sidebarCollapsed={false} onShowSidebar={onShowSidebar} /></TooltipProvider>)
    expect(screen.queryByTestId('collapsed-chrome')).toBeNull()
  })
})
