import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Tab } from '@/types'
import { noteEntryForPath } from '@/folder/note-entry'
import { OpenEditors } from './open-editors'

const tab = (path: string): Tab => ({ entry: noteEntryForPath(path, ''), content: '' })
const tabs = [tab('/n/a.md'), tab('/elsewhere/b.md')]

describe('open-editors', () => {
  it('lists one row per open Tab under its label, with the active row selected', () => {
    render(<OpenEditors tabs={tabs} activeTabPath="/elsewhere/b.md" onActivate={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText('Open Editors')).toBeInTheDocument()
    const rows = screen.getAllByRole('option')
    expect(rows.map((row) => row.textContent)).toEqual(['a.md', 'b.md'])
    expect(rows.map((row) => row.getAttribute('aria-selected'))).toEqual(['false', 'true'])
  })

  it('is not in the DOM at zero Tabs', () => {
    render(<OpenEditors tabs={[]} activeTabPath={null} onActivate={vi.fn()} onClose={vi.fn()} />)

    expect(screen.queryByTestId('open-editors')).toBeNull()
    expect(screen.queryByText('Open Editors')).toBeNull()
  })

  it('activates a Tab from its row and closes it from the row\'s close affordance', () => {
    const onActivate = vi.fn()
    const onClose = vi.fn()
    render(<OpenEditors tabs={tabs} activeTabPath="/n/a.md" onActivate={onActivate} onClose={onClose} />)

    fireEvent.click(screen.getByRole('option', { name: 'b.md' }))
    expect(onActivate).toHaveBeenCalledWith('/elsewhere/b.md')

    fireEvent.click(screen.getByRole('button', { name: 'Close a.md' }))
    expect(onClose).toHaveBeenCalledWith('/n/a.md')
    expect(onActivate).toHaveBeenCalledTimes(1)
  })
})
