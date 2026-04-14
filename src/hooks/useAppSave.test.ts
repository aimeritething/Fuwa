import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { SetStateAction } from 'react'
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
    handleSwitchTab: vi.fn(),
    setToastMessage: vi.fn(),
    loadModifiedFiles: vi.fn(),
    clearUnsaved: vi.fn(),
    unsavedPaths: new Set<string>(),
    tabs: [] as Array<{ entry: VaultEntry; content: string }>,
    activeTabPath: null as string | null,
    handleRenameNote: vi.fn().mockResolvedValue(undefined),
    handleRenameFilename: vi.fn().mockResolvedValue(undefined),
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
    deps.handleRenameFilename.mockResolvedValue(undefined)
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

  it('switches the active tab to the renamed path after untitled H1 auto-rename', async () => {
    vi.useFakeTimers()
    vi.mocked(isTauri).mockReturnValue(true)

    const oldPath = '/vault/untitled-note-123.md'
    const newPath = '/vault/fresh-title.md'
    const entry = makeEntry(oldPath, 'Untitled Note 123', 'untitled-note-123.md')
    let tabsState = [{ entry, content: '# Fresh Title\n\nBody' }]
    const setTabs = vi.fn((updater: SetStateAction<typeof tabsState>) => {
      tabsState = typeof updater === 'function' ? updater(tabsState) : updater
    })

    vi.mocked(invoke).mockImplementation(async (command: string, args?: Record<string, unknown>) => {
      if (command === 'save_note_content') return undefined
      if (command === 'auto_rename_untitled') return { new_path: newPath, updated_files: 0 }
      if (command === 'reload_vault_entry') return makeEntry(newPath, 'Fresh Title', 'fresh-title.md')
      if (command === 'get_note_content' && args?.path === newPath) return '# Fresh Title\n\nBody'
      return undefined
    })

    const { result } = renderSave({
      setTabs,
      tabs: tabsState,
      activeTabPath: oldPath,
      unsavedPaths: new Set([oldPath]),
    })

    await act(async () => {
      result.current.handleContentChange(oldPath, '# Fresh Title\n\nBody')
      await vi.advanceTimersByTimeAsync(3_000)
    })

    expect(deps.handleSwitchTab).toHaveBeenCalledWith(newPath)
    expect(tabsState[0].entry.path).toBe(newPath)
    expect(tabsState[0].entry.filename).toBe('fresh-title.md')
    expect(tabsState[0].content).toBe('# Fresh Title\n\nBody')
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

  it('redirects stale editor saves to the latest renamed path', async () => {
    vi.useFakeTimers()
    vi.mocked(isTauri).mockReturnValue(true)

    const oldPath = '/vault/untitled-note-123.md'
    const newPath = '/vault/fresh-title.md'
    const entry = makeEntry(oldPath, 'Untitled Note 123', 'untitled-note-123.md')
    let tabsState = [{ entry, content: '# Fresh Title\n\nBody' }]
    const setTabs = vi.fn((updater: SetStateAction<typeof tabsState>) => {
      tabsState = typeof updater === 'function' ? updater(tabsState) : updater
    })

    vi.mocked(invoke).mockImplementation(async (command: string, args?: Record<string, unknown>) => {
      if (command === 'save_note_content') return undefined
      if (command === 'auto_rename_untitled') return { new_path: newPath, updated_files: 0 }
      if (command === 'reload_vault_entry') return makeEntry(newPath, 'Fresh Title', 'fresh-title.md')
      if (command === 'get_note_content' && args?.path === newPath) return '# Fresh Title\n\nBody'
      return undefined
    })

    const { result } = renderSave({
      setTabs,
      tabs: tabsState,
      activeTabPath: oldPath,
      unsavedPaths: new Set([oldPath]),
    })

    await act(async () => {
      result.current.handleContentChange(oldPath, '# Fresh Title\n\nBody')
      await vi.advanceTimersByTimeAsync(3_000)
    })

    await act(async () => {
      result.current.handleContentChange(oldPath, '# Fresh Title\n\nBody\n\nMore text')
      await vi.advanceTimersByTimeAsync(500)
    })

    const saveCalls = vi.mocked(invoke).mock.calls.filter(([command]) => command === 'save_note_content')
    expect(saveCalls.at(-1)).toEqual([
      'save_note_content',
      { path: newPath, content: '# Fresh Title\n\nBody\n\nMore text' },
    ])
    expect(saveCalls).not.toContainEqual([
      'save_note_content',
      { path: oldPath, content: '# Fresh Title\n\nBody\n\nMore text' },
    ])
  })

  it('tracks filename renames so follow-up saves do not recreate the old path', async () => {
    vi.useFakeTimers()
    vi.mocked(isTauri).mockReturnValue(true)

    const oldPath = '/vault/fresh-title.md'
    const newPath = '/vault/manual-name.md'
    const entry = makeEntry(oldPath, 'Fresh Title', 'fresh-title.md')

    vi.mocked(invoke).mockImplementation(async (command: string) => {
      if (command === 'save_note_content') return undefined
      return undefined
    })

    deps.handleRenameFilename.mockImplementation(async (path, newFilenameStem, vaultPath, onEntryRenamed) => {
      expect(path).toBe(oldPath)
      expect(newFilenameStem).toBe('manual-name')
      expect(vaultPath).toBe('/vault')
      onEntryRenamed(path, { path: newPath, filename: 'manual-name.md', title: 'Fresh Title' }, '# Fresh Title\n\nBody')
    })

    const { result } = renderSave({
      tabs: [{ entry, content: '# Fresh Title\n\nBody' }],
      activeTabPath: oldPath,
      unsavedPaths: new Set([oldPath]),
    })

    await act(async () => {
      await result.current.handleFilenameRename(oldPath, 'manual-name')
    })

    await act(async () => {
      result.current.handleContentChange(oldPath, '# Fresh Title\n\nBody\n\nMore text')
      await vi.advanceTimersByTimeAsync(500)
    })

    const saveCalls = vi.mocked(invoke).mock.calls.filter(([command]) => command === 'save_note_content')
    expect(saveCalls.at(-1)).toEqual([
      'save_note_content',
      { path: newPath, content: '# Fresh Title\n\nBody\n\nMore text' },
    ])
    expect(saveCalls).not.toContainEqual([
      'save_note_content',
      { path: oldPath, content: '# Fresh Title\n\nBody\n\nMore text' },
    ])
    expect(deps.replaceEntry).toHaveBeenCalledWith(
      oldPath,
      expect.objectContaining({ path: newPath, filename: 'manual-name.md' }),
      '# Fresh Title\n\nBody',
    )
  })

  it('uses the latest active tab content when untitled auto-rename resolves after continued typing', async () => {
    vi.useFakeTimers()
    vi.mocked(isTauri).mockReturnValue(true)

    const oldPath = '/vault/untitled-note-123.md'
    const newPath = '/vault/fresh-title.md'
    const entry = makeEntry(oldPath, 'Untitled Note 123', 'untitled-note-123.md')
    let tabsState = [{ entry, content: '# Fresh Title\n\nBody' }]
    const setTabs = vi.fn((updater: SetStateAction<typeof tabsState>) => {
      tabsState = typeof updater === 'function' ? updater(tabsState) : updater
    })

    vi.mocked(invoke).mockImplementation(async (command: string, args?: Record<string, unknown>) => {
      if (command === 'save_note_content') return undefined
      if (command === 'auto_rename_untitled') return { new_path: newPath, updated_files: 0 }
      if (command === 'reload_vault_entry') return makeEntry(newPath, 'Fresh Title', 'fresh-title.md')
      if (command === 'get_note_content' && args?.path === newPath) return '# Fresh Title\n\nBody from disk'
      return undefined
    })

    const { result, rerender } = renderHook(
      ({ currentTabs, currentActiveTabPath }: { currentTabs: typeof tabsState; currentActiveTabPath: string | null }) => useAppSave({
        ...deps,
        setTabs,
        tabs: currentTabs,
        activeTabPath: currentActiveTabPath,
        unsavedPaths: new Set([oldPath]),
      }),
      {
        initialProps: {
          currentTabs: tabsState,
          currentActiveTabPath: oldPath,
        },
      },
    )

    await act(async () => {
      result.current.handleContentChange(oldPath, '# Fresh Title\n\nBody')
      await vi.advanceTimersByTimeAsync(500)
    })

    tabsState = [{ entry, content: '# Fresh Title\n\nBody that keeps changing while rename is pending' }]
    rerender({
      currentTabs: tabsState,
      currentActiveTabPath: oldPath,
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_500)
    })

    expect(deps.replaceEntry).toHaveBeenCalledWith(
      oldPath,
      expect.objectContaining({ path: newPath, filename: 'fresh-title.md' }),
      '# Fresh Title\n\nBody that keeps changing while rename is pending',
    )
    expect(tabsState[0].entry.path).toBe(newPath)
    expect(tabsState[0].content).toBe('# Fresh Title\n\nBody that keeps changing while rename is pending')
  })
})
