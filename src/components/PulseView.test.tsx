import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PulseView } from './PulseView'
import type { PulseCommit } from '../types'

const mockCommits: PulseCommit[] = [
  {
    hash: 'abc123def456',
    shortHash: 'abc123d',
    message: 'Update project notes',
    date: Math.floor(Date.now() / 1000) - 3600,
    githubUrl: 'https://github.com/owner/repo/commit/abc123def456',
    files: [
      { path: 'project/my-project.md', status: 'modified', title: 'my project' },
      { path: 'note/new-note.md', status: 'added', title: 'new note' },
    ],
    added: 1,
    modified: 1,
    deleted: 0,
  },
  {
    hash: 'def456abc789',
    shortHash: 'def456a',
    message: 'Remove old notes',
    date: Math.floor(Date.now() / 1000) - 86400,
    githubUrl: null,
    files: [
      { path: 'note/old.md', status: 'deleted', title: 'old' },
    ],
    added: 0,
    modified: 0,
    deleted: 1,
  },
]

const mockInvokeFn = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvokeFn(...args),
}))
vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (...args: unknown[]) => mockInvokeFn(...args),
}))

describe('PulseView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially', () => {
    mockInvokeFn.mockReturnValue(new Promise(() => {})) // never resolves
    render(<PulseView vaultPath="/test/vault" />)
    expect(screen.getByText('Loading activity…')).toBeInTheDocument()
  })

  it('renders commits grouped by day', async () => {
    mockInvokeFn.mockResolvedValue(mockCommits)

    render(<PulseView vaultPath="/test/vault" />)

    await waitFor(() => {
      expect(screen.getByText('Update project notes')).toBeInTheDocument()
    })

    expect(screen.getByText('Remove old notes')).toBeInTheDocument()
  })

  it('shows summary badges for added/modified/deleted', async () => {
    mockInvokeFn.mockResolvedValue(mockCommits)

    render(<PulseView vaultPath="/test/vault" />)

    await waitFor(() => {
      expect(screen.getByText('+1')).toBeInTheDocument()
    })
    expect(screen.getByText('~1')).toBeInTheDocument()
    expect(screen.getByText('-1')).toBeInTheDocument()
  })

  it('shows commit hashes', async () => {
    mockInvokeFn.mockResolvedValue(mockCommits)

    render(<PulseView vaultPath="/test/vault" />)

    await waitFor(() => {
      expect(screen.getByText('abc123d')).toBeInTheDocument()
    })
    expect(screen.getByText('def456a')).toBeInTheDocument()
  })

  it('renders GitHub links for commits with githubUrl', async () => {
    mockInvokeFn.mockResolvedValue(mockCommits)

    render(<PulseView vaultPath="/test/vault" />)

    await waitFor(() => {
      const link = screen.getByText('abc123d')
      expect(link.tagName).toBe('A')
      expect(link).toHaveAttribute('href', 'https://github.com/owner/repo/commit/abc123def456')
    })

    // Non-GitHub commit should be a span
    const nonLink = screen.getByText('def456a')
    expect(nonLink.tagName).toBe('SPAN')
  })

  it('renders file list with correct titles when expanded', async () => {
    mockInvokeFn.mockResolvedValue(mockCommits)

    render(<PulseView vaultPath="/test/vault" />)

    // Files are collapsed by default — expand all commit cards first
    await waitFor(() => {
      expect(screen.getAllByLabelText('Expand files').length).toBeGreaterThan(0)
    })
    screen.getAllByLabelText('Expand files').forEach((btn) => fireEvent.click(btn))

    await waitFor(() => {
      expect(screen.getByText('my project')).toBeInTheDocument()
    })
    expect(screen.getByText('new note')).toBeInTheDocument()
    expect(screen.getByText('old')).toBeInTheDocument()
  })

  it('calls onOpenNote when clicking a non-deleted file', async () => {
    mockInvokeFn.mockResolvedValue(mockCommits)
    const onOpenNote = vi.fn()

    render(<PulseView vaultPath="/test/vault" onOpenNote={onOpenNote} />)

    // Expand first commit card
    await waitFor(() => {
      expect(screen.getAllByLabelText('Expand files').length).toBeGreaterThan(0)
    })
    fireEvent.click(screen.getAllByLabelText('Expand files')[0])

    await waitFor(() => {
      expect(screen.getByText('my project')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('my project'))
    expect(onOpenNote).toHaveBeenCalledWith('project/my-project.md')
  })

  it('does not call onOpenNote when clicking a deleted file', async () => {
    mockInvokeFn.mockResolvedValue(mockCommits)
    const onOpenNote = vi.fn()

    render(<PulseView vaultPath="/test/vault" onOpenNote={onOpenNote} />)

    // Expand all commit cards to find the deleted file
    await waitFor(() => {
      expect(screen.getAllByLabelText('Expand files').length).toBeGreaterThan(0)
    })
    screen.getAllByLabelText('Expand files').forEach((btn) => fireEvent.click(btn))

    await waitFor(() => {
      expect(screen.getByText('old')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('old'))
    expect(onOpenNote).not.toHaveBeenCalled()
  })

  it('shows empty state when no commits', async () => {
    mockInvokeFn.mockResolvedValue([])

    render(<PulseView vaultPath="/test/vault" />)

    await waitFor(() => {
      expect(screen.getByText('No activity yet')).toBeInTheDocument()
    })
  })

  it('shows error state and retry button', async () => {
    mockInvokeFn.mockRejectedValue('Not a git repository')

    render(<PulseView vaultPath="/test/vault" />)

    await waitFor(() => {
      expect(screen.getByText('Not a git repository')).toBeInTheDocument()
    })
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('shows Load more button when hasMore is true', async () => {
    const manyCommits = Array.from({ length: 30 }, (_, i) => ({
      ...mockCommits[0],
      hash: `hash${i}`,
      shortHash: `h${i}`,
      message: `Commit ${i}`,
    }))
    mockInvokeFn.mockResolvedValue(manyCommits)

    render(<PulseView vaultPath="/test/vault" />)

    await waitFor(() => {
      expect(screen.getByText('Load more')).toBeInTheDocument()
    })
  })

  it('calls get_vault_pulse with correct arguments', async () => {
    mockInvokeFn.mockResolvedValue([])

    render(<PulseView vaultPath="/my/vault" />)

    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith('get_vault_pulse', { vaultPath: '/my/vault', limit: 30 })
    })
  })

  it('toggles file list visibility when clicking expand/collapse button', async () => {
    mockInvokeFn.mockResolvedValue(mockCommits)

    render(<PulseView vaultPath="/test/vault" />)

    // Files are collapsed by default
    await waitFor(() => {
      expect(screen.getAllByLabelText('Expand files').length).toBeGreaterThan(0)
    })
    expect(screen.queryByText('my project')).not.toBeInTheDocument()

    // Click expand on first commit card
    fireEvent.click(screen.getAllByLabelText('Expand files')[0])

    // Files should now be visible
    await waitFor(() => {
      expect(screen.getByText('my project')).toBeInTheDocument()
    })

    // Click collapse to hide again
    fireEvent.click(screen.getAllByLabelText('Collapse files')[0])

    expect(screen.queryByText('my project')).not.toBeInTheDocument()
  })

  it('renders Pulse header', async () => {
    mockInvokeFn.mockResolvedValue([])

    render(<PulseView vaultPath="/test/vault" />)

    await waitFor(() => {
      expect(screen.getByText('Pulse')).toBeInTheDocument()
    })
  })
})
