import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAppSave } from './useAppSave'
import type { VaultEntry } from '../types'
import { isTauri } from '../mock-tauri'
import { invoke } from '@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../mock-tauri', () => ({
  isTauri: vi.fn(() => false),
  mockInvoke: vi.fn().mockResolvedValue(undefined),
  updateMockContent: vi.fn(),
}))

function makeEntry(path: string, title = 'Test', filename = 'test.md'): VaultEntry {
  return { path, title, filename, content: '', outgoingLinks: [], snippet: '', wordCount: 0, isA: 'Note', status: null, createdAt: null, modifiedAt: null, icon: null, tags: [] } as unknown as VaultEntry
}

describe('useAppSave', () => {
  const deps = {
    updateEntry: vi.fn(),
    setTabs: vi.fn(),
    setToastMessage: vi.fn(),
    loadModifiedFiles: vi.fn(),
    clearUnsaved: vi.fn(),
    unsavedPaths: new Set<string>(),
    tabs: [] as Array<{ entry: VaultEntry; content: string }>,
    activeTabPath: null as string | null,
    handleRenameNote: vi.fn().mockResolvedValue(undefined),
    replaceEntry: vi.fn(),
    resolvedPath: '/vault',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    vi.mocked(isTauri).mockReturnValue(false)
    deps.unsavedPaths = new Set()
    deps.tabs = []
    deps.activeTabPath = null
    deps.handleRenameNote.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function renderSave(overrides = {}) {
    return renderHook(() => useAppSave({ ...deps, ...overrides }))
  }

  it('exposes contentChangeRef', () => {
    const { result } = renderSave()
    expect(result.current.contentChangeRef).toBeDefined()
    expect(typeof result.current.contentChangeRef.current).toBe('function')
  })

  it('exposes handleSave', () => {
    const { result } = renderSave()
    expect(typeof result.current.handleSave).toBe('function')
  })

  it('exposes handleTitleSync', () => {
    const { result } = renderSave()
    expect(typeof result.current.handleTitleSync).toBe('function')
  })

  it('exposes flushBeforeAction', () => {
    const { result } = renderSave()
    expect(typeof result.current.flushBeforeAction).toBe('function')
  })

  it('handleSave calls save with no fallback when no active tab', async () => {
    const { result } = renderSave()

    await act(async () => { await result.current.handleSave() })

    // Should not throw — just a no-op save
  })

  it('handleSave provides fallback for unsaved active tab', async () => {
    const entry = makeEntry('/vault/note.md', 'note', 'note.md')
    const unsavedPaths = new Set(['/vault/note.md'])
    const tabs = [{ entry, content: '# Hello' }]

    const { result } = renderSave({
      tabs,
      activeTabPath: '/vault/note.md',
      unsavedPaths,
    })

    await act(async () => { await result.current.handleSave() })

    // Should complete without error
  })

  it('handleContentChange is a function', () => {
    const { result } = renderSave()
    expect(typeof result.current.handleContentChange).toBe('function')
  })

  it('debounces untitled H1 auto-rename until the user pauses typing', async () => {
    vi.useFakeTimers()
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(invoke).mockImplementation(async (command: string, args?: Record<string, unknown>) => {
      if (command === 'save_note_content') return undefined
      if (command === 'auto_rename_untitled') return { new_path: '/vault/fresh-title.md', updated_files: 0 }
      if (command === 'reload_vault_entry') return makeEntry('/vault/fresh-title.md', 'Fresh Title', 'fresh-title.md')
      if (command === 'get_note_content' && args?.path === '/vault/fresh-title.md') return '# Fresh Title\n\nBody'
      return undefined
    })

    const entry = makeEntry('/vault/untitled-note-123.md', 'Untitled Note 123', 'untitled-note-123.md')
    const tabs = [{ entry, content: '# Fresh Title\n\nBody' }]
    const { result } = renderSave({
      tabs,
      activeTabPath: entry.path,
      unsavedPaths: new Set([entry.path]),
    })

    await act(async () => {
      result.current.handleContentChange(entry.path, '# Fresh Title\n\nBody')
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(vi.mocked(invoke)).not.toHaveBeenCalledWith('auto_rename_untitled', expect.anything())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_499)
    })
    expect(vi.mocked(invoke)).not.toHaveBeenCalledWith('auto_rename_untitled', expect.anything())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })

    expect(vi.mocked(invoke)).toHaveBeenCalledWith('auto_rename_untitled', {
      vaultPath: '/vault',
      notePath: entry.path,
    })
    expect(deps.replaceEntry).toHaveBeenCalledWith(
      entry.path,
      expect.objectContaining({ path: '/vault/fresh-title.md', filename: 'fresh-title.md' }),
      '# Fresh Title\n\nBody',
    )
  })

  it('cancels a pending untitled auto-rename when the user navigates away', async () => {
    vi.useFakeTimers()
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(invoke).mockImplementation(async (command: string) => {
      if (command === 'save_note_content') return undefined
      if (command === 'auto_rename_untitled') return { new_path: '/vault/fresh-title.md', updated_files: 0 }
      return undefined
    })

    const entry = makeEntry('/vault/untitled-note-123.md', 'Untitled Note 123', 'untitled-note-123.md')
    const tabs = [{ entry, content: '# Fresh Title\n\nBody' }]
    const { result, rerender } = renderHook(
      ({ currentActiveTabPath }: { currentActiveTabPath: string | null }) => useAppSave({
        ...deps,
        tabs,
        activeTabPath: currentActiveTabPath,
        unsavedPaths: new Set([entry.path]),
      }),
      { initialProps: { currentActiveTabPath: entry.path } },
    )

    await act(async () => {
      result.current.handleContentChange(entry.path, '# Fresh Title\n\nBody')
      await vi.advanceTimersByTimeAsync(500)
    })

    rerender({ currentActiveTabPath: '/vault/other.md' })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_500)
    })

    expect(vi.mocked(invoke)).not.toHaveBeenCalledWith('auto_rename_untitled', expect.anything())
  })
})
