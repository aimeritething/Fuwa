import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FolderTree } from './FolderTree'
import type { FolderNode, SidebarSelection } from '../types'

const mockFolders: FolderNode[] = [
  {
    name: 'projects',
    path: 'projects',
    children: [
      { name: 'laputa', path: 'projects/laputa', children: [] },
      { name: 'portfolio', path: 'projects/portfolio', children: [] },
    ],
  },
  { name: 'areas', path: 'areas', children: [] },
  { name: 'journal', path: 'journal', children: [] },
]

const defaultSelection: SidebarSelection = { kind: 'filter', filter: 'all' }

describe('FolderTree', () => {
  it('renders nothing when folders is empty', () => {
    const { container } = render(
      <FolderTree folders={[]} selection={defaultSelection} onSelect={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders FOLDERS header and top-level folders', () => {
    render(<FolderTree folders={mockFolders} selection={defaultSelection} onSelect={vi.fn()} />)
    expect(screen.getByText('FOLDERS')).toBeInTheDocument()
    expect(screen.getByText('projects')).toBeInTheDocument()
    expect(screen.getByText('areas')).toBeInTheDocument()
    expect(screen.getByText('journal')).toBeInTheDocument()
  })

  it('does not show children initially', () => {
    render(<FolderTree folders={mockFolders} selection={defaultSelection} onSelect={vi.fn()} />)
    expect(screen.queryByText('laputa')).not.toBeInTheDocument()
  })

  it('calls onSelect with folder kind when clicking a folder', () => {
    const onSelect = vi.fn()
    render(<FolderTree folders={mockFolders} selection={defaultSelection} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('projects'))
    expect(onSelect).toHaveBeenCalledWith({ kind: 'folder', path: 'projects' })
  })

  it('expands children when clicking a folder with children', () => {
    const onSelect = vi.fn()
    render(<FolderTree folders={mockFolders} selection={defaultSelection} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('projects'))
    expect(screen.getByText('laputa')).toBeInTheDocument()
    expect(screen.getByText('portfolio')).toBeInTheDocument()
  })

  it('collapses section when clicking FOLDERS header', () => {
    render(<FolderTree folders={mockFolders} selection={defaultSelection} onSelect={vi.fn()} />)
    expect(screen.getByText('projects')).toBeInTheDocument()
    fireEvent.click(screen.getByText('FOLDERS'))
    expect(screen.queryByText('projects')).not.toBeInTheDocument()
  })

  it('highlights selected folder', () => {
    const sel: SidebarSelection = { kind: 'folder', path: 'areas' }
    render(<FolderTree folders={mockFolders} selection={sel} onSelect={vi.fn()} />)
    const btn = screen.getByText('areas').closest('button')!
    expect(btn.className).toContain('text-primary')
  })
})
