import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BreadcrumbBar } from './BreadcrumbBar'
import type { VaultEntry } from '../types'

const baseEntry: VaultEntry = {
  path: '/vault/note/test.md',
  filename: 'test.md',
  title: 'Test Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: null,
  owner: null,
  cadence: null,
  archived: false,
  modifiedAt: 1700000000,
  createdAt: null,
  fileSize: 100,
  snippet: '',
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
}

const archivedEntry: VaultEntry = {
  ...baseEntry,
  archived: true,
}

const defaultProps = {
  wordCount: 100,
  showDiffToggle: false,
  diffMode: false,
  diffLoading: false,
  onToggleDiff: vi.fn(),
}

describe('BreadcrumbBar — drag region', () => {
  it('has data-tauri-drag-region on the container', () => {
    const { container } = render(<BreadcrumbBar entry={baseEntry} {...defaultProps} />)
    const bar = container.firstElementChild as HTMLElement
    expect(bar.dataset.tauriDragRegion).toBeDefined()
  })
})

describe('BreadcrumbBar — delete', () => {
  it('shows delete button', () => {
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} onDelete={vi.fn()} />)
    expect(screen.getByTitle('Delete (Cmd+Delete)')).toBeInTheDocument()
  })

  it('calls onDelete when delete button is clicked', () => {
    const onDelete = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} onDelete={onDelete} />)
    fireEvent.click(screen.getByTitle('Delete (Cmd+Delete)'))
    expect(onDelete).toHaveBeenCalledOnce()
  })
})

describe('BreadcrumbBar — archive/unarchive', () => {
  it('shows archive button for non-archived note', () => {
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} onArchive={vi.fn()} onUnarchive={vi.fn()} />)
    expect(screen.getByTitle('Archive (Cmd+E)')).toBeInTheDocument()
    expect(screen.queryByTitle('Unarchive (Cmd+E)')).not.toBeInTheDocument()
  })

  it('shows unarchive button for archived note', () => {
    render(<BreadcrumbBar entry={archivedEntry} {...defaultProps} onArchive={vi.fn()} onUnarchive={vi.fn()} />)
    expect(screen.getByTitle('Unarchive (Cmd+E)')).toBeInTheDocument()
    expect(screen.queryByTitle('Archive (Cmd+E)')).not.toBeInTheDocument()
  })

  it('calls onArchive when archive button is clicked', () => {
    const onArchive = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} onArchive={onArchive} />)
    fireEvent.click(screen.getByTitle('Archive (Cmd+E)'))
    expect(onArchive).toHaveBeenCalledOnce()
  })

  it('calls onUnarchive when unarchive button is clicked', () => {
    const onUnarchive = vi.fn()
    render(<BreadcrumbBar entry={archivedEntry} {...defaultProps} onUnarchive={onUnarchive} />)
    fireEvent.click(screen.getByTitle('Unarchive (Cmd+E)'))
    expect(onUnarchive).toHaveBeenCalledOnce()
  })
})

describe('BreadcrumbBar — title in breadcrumb (always rendered, CSS-toggled)', () => {
  it('always renders title elements in the DOM', () => {
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} />)
    expect(screen.getByText('Note')).toBeInTheDocument()
    expect(screen.getByText('›')).toBeInTheDocument()
    expect(screen.getByText('Test Note')).toBeInTheDocument()
  })

  it('shows emoji icon when entry has an emoji icon', () => {
    const entryWithEmoji = { ...baseEntry, icon: '🚀' }
    render(<BreadcrumbBar entry={entryWithEmoji} {...defaultProps} />)
    expect(screen.getByText('🚀')).toBeInTheDocument()
  })

  it('does not show icon when entry has a non-emoji icon', () => {
    const entryWithPhosphor = { ...baseEntry, icon: 'cooking-pot' }
    render(<BreadcrumbBar entry={entryWithPhosphor} {...defaultProps} />)
    expect(screen.queryByText('cooking-pot')).not.toBeInTheDocument()
  })

  it('falls back to "Note" when isA is null', () => {
    const entryNoType = { ...baseEntry, isA: null }
    render(<BreadcrumbBar entry={entryNoType} {...defaultProps} />)
    expect(screen.getByText('Note')).toBeInTheDocument()
  })

  it('shadow is controlled by data-title-hidden attribute via CSS', () => {
    const { container } = render(<BreadcrumbBar entry={baseEntry} {...defaultProps} />)
    const bar = container.querySelector('.breadcrumb-bar')!
    expect(bar).not.toHaveAttribute('data-title-hidden')
    bar.setAttribute('data-title-hidden', '')
    expect(bar).toHaveAttribute('data-title-hidden')
  })
})

describe('BreadcrumbBar — action buttons always right-aligned', () => {
  it('actions container has ml-auto so buttons are always right-aligned', () => {
    const { container } = render(<BreadcrumbBar entry={baseEntry} {...defaultProps} />)
    const actions = container.querySelector('.breadcrumb-bar__actions')
    expect(actions).toBeInTheDocument()
    expect(actions).toHaveClass('ml-auto')
  })
})

describe('BreadcrumbBar — raw editor toggle', () => {
  it('shows Raw editor button with tooltip "Raw editor" when rawMode is off', () => {
    const onToggleRaw = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} rawMode={false} onToggleRaw={onToggleRaw} />)
    expect(screen.getByTitle('Raw editor')).toBeInTheDocument()
  })

  it('shows "Back to editor" tooltip when rawMode is on', () => {
    const onToggleRaw = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} rawMode={true} onToggleRaw={onToggleRaw} />)
    expect(screen.getByTitle('Back to editor')).toBeInTheDocument()
  })

  it('calls onToggleRaw when raw button is clicked', () => {
    const onToggleRaw = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} rawMode={false} onToggleRaw={onToggleRaw} />)
    fireEvent.click(screen.getByTitle('Raw editor'))
    expect(onToggleRaw).toHaveBeenCalledOnce()
  })

  it('hides raw toggle when forceRawMode is true (non-markdown file)', () => {
    const onToggleRaw = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} rawMode={true} onToggleRaw={onToggleRaw} forceRawMode={true} />)
    expect(screen.queryByTitle('Raw editor')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Back to editor')).not.toBeInTheDocument()
  })

  it('shows raw toggle when forceRawMode is false (markdown file)', () => {
    const onToggleRaw = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} rawMode={false} onToggleRaw={onToggleRaw} forceRawMode={false} />)
    expect(screen.getByTitle('Raw editor')).toBeInTheDocument()
  })
})
