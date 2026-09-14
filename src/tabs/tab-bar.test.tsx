import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Tab } from '@/types'
import { noteEntryForPath } from '@/folder/note-entry'
import { TabBar } from './tab-bar'
import { TooltipProvider } from '@/ui/tooltip'

const tab = (path: string): Tab => ({ entry: noteEntryForPath(path, ''), content: '' })
const tabs = [tab('/n/a.md'), tab('/n/b.md'), tab('/n/c.md')]

describe('tab-bar', () => {
  it('shows one Tab per open Document with the active one selected', () => {
    render(<TabBar tabs={tabs} activeTabPath="/n/b.md" onActivate={vi.fn()} onClose={vi.fn()} />)

    const rendered = screen.getAllByRole('tab')
    expect(rendered.map((element) => element.textContent)).toEqual(['a.md', 'b.md', 'c.md'])
    expect(rendered.map((element) => element.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false'])
  })

  it('is absent with no Tab open', () => {
    render(<TabBar tabs={[]} activeTabPath={null} onActivate={vi.fn()} onClose={vi.fn()} />)

    expect(screen.queryByTestId('tab-bar')).toBeNull()
  })

  it('activates a Tab on click and closes it from its close affordance without activating it', () => {
    const onActivate = vi.fn()
    const onClose = vi.fn()
    render(<TabBar tabs={tabs} activeTabPath="/n/a.md" onActivate={onActivate} onClose={onClose} />)

    fireEvent.click(screen.getByRole('tab', { name: 'c.md' }))
    expect(onActivate).toHaveBeenCalledWith('/n/c.md')

    fireEvent.click(screen.getByRole('button', { name: 'Close b.md' }))
    expect(onClose).toHaveBeenCalledWith('/n/b.md')
    expect(onActivate).toHaveBeenCalledTimes(1)
  })

  it('with the sidebar collapsed, seats the traffic lights and the sidebar icon before the first tab', () => {
    const onShowSidebar = vi.fn()
    render(
      <TooltipProvider>
        <TabBar tabs={tabs} activeTabPath="/n/a.md" onActivate={vi.fn()} onClose={vi.fn()} sidebarCollapsed onShowSidebar={onShowSidebar} />
      </TooltipProvider>,
    )

    const bar = screen.getByTestId('tab-bar')
    const chrome = screen.getByTestId('collapsed-chrome')
    expect(bar).toContainElement(chrome)
    expect(chrome.compareDocumentPosition(screen.getByRole('tab', { name: 'a.md' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show sidebar' }))
    expect(onShowSidebar).toHaveBeenCalledTimes(1)
  })

  it('carries no chrome while the sidebar is shown', () => {
    render(<TabBar tabs={tabs} activeTabPath="/n/a.md" onActivate={vi.fn()} onClose={vi.fn()} sidebarCollapsed={false} onShowSidebar={vi.fn()} />)

    expect(screen.queryByTestId('collapsed-chrome')).toBeNull()
  })
})
