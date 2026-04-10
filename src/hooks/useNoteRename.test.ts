import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { VaultEntry } from '../types'
import {
  needsRenameOnSave,
  buildRenamedEntry,
  renameToastMessage,
  useNoteRename,
} from './useNoteRename'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('../mock-tauri', () => ({
  isTauri: vi.fn(() => false),
  addMockEntry: vi.fn(),
  updateMockContent: vi.fn(),
  trackMockChange: vi.fn(),
  mockInvoke: vi.fn().mockResolvedValue(''),
}))

const makeEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  path: '/vault/test.md', filename: 'test.md', title: 'Test Note', isA: 'Note',
  aliases: [], belongsTo: [], relatedTo: [], status: 'Active', archived: false,
  modifiedAt: 1700000000, createdAt: 1700000000, fileSize: 100, snippet: '',
  wordCount: 0, relationships: {}, icon: null, color: null, order: null,
  outgoingLinks: [], template: null, sort: null, sidebarLabel: null,
  view: null, visible: null, properties: {},
  ...overrides,
})

describe('needsRenameOnSave', () => {
  it('returns true when filename does not match title slug', () => {
    expect(needsRenameOnSave('My New Note', 'untitled-note.md')).toBe(true)
  })

  it('returns false when filename matches title slug', () => {
    expect(needsRenameOnSave('My Note', 'my-note.md')).toBe(false)
  })

  it('returns false for untitled note with matching slug', () => {
    expect(needsRenameOnSave('Untitled note', 'untitled-note.md')).toBe(false)
  })
})

describe('buildRenamedEntry', () => {
  it('creates entry with new title and path', () => {
    const entry = makeEntry({ path: '/vault/old.md', filename: 'old.md', title: 'Old' })
    const renamed = buildRenamedEntry(entry, 'New Title', '/vault/new-title.md')
    expect(renamed.path).toBe('/vault/new-title.md')
    expect(renamed.title).toBe('New Title')
    expect(renamed.filename).toBe('new-title.md')
    expect(renamed.isA).toBe('Note')
  })

  it('preserves other entry fields', () => {
    const entry = makeEntry({ status: 'Done', aliases: ['x'] })
    const renamed = buildRenamedEntry(entry, 'Renamed', '/vault/renamed.md')
    expect(renamed.status).toBe('Done')
    expect(renamed.aliases).toEqual(['x'])
  })
})

describe('renameToastMessage', () => {
  it('returns "Renamed" when no files updated', () => {
    expect(renameToastMessage(0)).toBe('Renamed')
  })

  it('returns singular when 1 file updated', () => {
    expect(renameToastMessage(1)).toBe('Renamed — updated 1 wiki link')
  })

  it('returns plural when multiple files updated', () => {
    expect(renameToastMessage(3)).toBe('Renamed — updated 3 wiki links')
  })
})

describe('useNoteRename hook', () => {
  const setToastMessage = vi.fn()
  const setTabs = vi.fn((fn: (prev: unknown[]) => unknown[]) => fn([]))
  const handleSwitchTab = vi.fn()
  const updateTabContent = vi.fn()
  const activeTabPathRef = { current: null as string | null }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isTauri).mockReturnValue(false)
    activeTabPathRef.current = null
  })

  it('handleRenameNote calls rename_note and updates toast', async () => {
    const entry = makeEntry({ path: '/vault/old.md', title: 'Old' })
    vi.mocked(mockInvoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'rename_note') return { new_path: '/vault/new.md', updated_files: 2 }
      if (cmd === 'get_note_content') return '# New\n'
      return ''
    })

    const { result } = renderHook(() => useNoteRename(
      { entries: [entry], setToastMessage },
      { tabs: [], setTabs, activeTabPathRef, handleSwitchTab, updateTabContent },
    ))

    const onEntryRenamed = vi.fn()
    await act(async () => {
      await result.current.handleRenameNote('/vault/old.md', 'New', '/vault', onEntryRenamed)
    })

    expect(mockInvoke).toHaveBeenCalledWith('rename_note', expect.objectContaining({
      old_path: '/vault/old.md',
      new_title: 'New',
      old_title: 'Old',
    }))
    expect(setToastMessage).toHaveBeenCalledWith('Renamed — updated 2 wiki links')
    expect(onEntryRenamed).toHaveBeenCalled()
  })

  it('handleRenameNote passes null old_title when entry not found', async () => {
    vi.mocked(mockInvoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'rename_note') return { new_path: '/vault/new.md', updated_files: 0 }
      if (cmd === 'get_note_content') return '# New\n'
      return ''
    })

    const { result } = renderHook(() => useNoteRename(
      { entries: [], setToastMessage },
      { tabs: [], setTabs, activeTabPathRef, handleSwitchTab, updateTabContent },
    ))

    await act(async () => {
      await result.current.handleRenameNote('/vault/old.md', 'New', '/vault', vi.fn())
    })

    expect(mockInvoke).toHaveBeenCalledWith('rename_note', expect.objectContaining({ old_title: null }))
  })

  it('handleRenameNote shows error toast on failure', async () => {
    vi.mocked(mockInvoke).mockRejectedValueOnce(new Error('fail'))

    const { result } = renderHook(() => useNoteRename(
      { entries: [], setToastMessage },
      { tabs: [], setTabs, activeTabPathRef, handleSwitchTab, updateTabContent },
    ))

    await act(async () => {
      await result.current.handleRenameNote('/vault/old.md', 'New', '/vault', vi.fn())
    })

    expect(setToastMessage).toHaveBeenCalledWith('Failed to rename note')
  })

  it('switches active tab when renamed note is active', async () => {
    activeTabPathRef.current = '/vault/old.md'
    vi.mocked(mockInvoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'rename_note') return { new_path: '/vault/new.md', updated_files: 0 }
      if (cmd === 'get_note_content') return '# New\n'
      return ''
    })

    const { result } = renderHook(() => useNoteRename(
      { entries: [makeEntry({ path: '/vault/old.md' })], setToastMessage },
      { tabs: [], setTabs, activeTabPathRef, handleSwitchTab, updateTabContent },
    ))

    await act(async () => {
      await result.current.handleRenameNote('/vault/old.md', 'New', '/vault', vi.fn())
    })

    expect(handleSwitchTab).toHaveBeenCalledWith('/vault/new.md')
  })

  it('handleRenameFilename renames the file while preserving the existing title', async () => {
    const entry = makeEntry({ path: '/vault/old-name.md', filename: 'old-name.md', title: 'Project Kickoff' })
    vi.mocked(mockInvoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'rename_note_filename') return { new_path: '/vault/manual-name.md', updated_files: 1 }
      if (cmd === 'get_note_content') return '# Project Kickoff\n'
      return ''
    })

    const { result } = renderHook(() => useNoteRename(
      { entries: [entry], setToastMessage },
      { tabs: [], setTabs, activeTabPathRef, handleSwitchTab, updateTabContent },
    ))

    const onEntryRenamed = vi.fn()
    await act(async () => {
      await result.current.handleRenameFilename('/vault/old-name.md', 'manual-name', '/vault', onEntryRenamed)
    })

    expect(mockInvoke).toHaveBeenCalledWith('rename_note_filename', expect.objectContaining({
      old_path: '/vault/old-name.md',
      new_filename_stem: 'manual-name',
    }))
    expect(onEntryRenamed).toHaveBeenCalledWith(
      '/vault/old-name.md',
      expect.objectContaining({
        path: '/vault/manual-name.md',
        filename: 'manual-name.md',
        title: 'Project Kickoff',
      }),
      '# Project Kickoff\n',
    )
    expect(setToastMessage).toHaveBeenCalledWith('Renamed — updated 1 wiki link')
  })

  it('handleRenameFilename surfaces backend conflict errors', async () => {
    vi.mocked(mockInvoke).mockRejectedValueOnce(new Error('A note with that name already exists'))

    const { result } = renderHook(() => useNoteRename(
      { entries: [makeEntry({ path: '/vault/old-name.md', filename: 'old-name.md' })], setToastMessage },
      { tabs: [], setTabs, activeTabPathRef, handleSwitchTab, updateTabContent },
    ))

    await act(async () => {
      await result.current.handleRenameFilename('/vault/old-name.md', 'manual-name', '/vault', vi.fn())
    })

    expect(setToastMessage).toHaveBeenCalledWith('A note with that name already exists')
  })
})
