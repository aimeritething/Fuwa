import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { VaultEntry } from '../types'
import { useTabManagement, prefetchNoteContent, cacheNoteContent, clearPrefetchCache } from './useTabManagement'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: vi.fn().mockResolvedValue('# Mock content'),
}))

const makeEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  path: '/vault/note/test.md',
  filename: 'test.md',
  title: 'Test Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: 'Active',
  archived: false,
  modifiedAt: 1700000000,
  createdAt: 1700000000,
  fileSize: 100,
  snippet: '',
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  template: null, sort: null,
  outgoingLinks: [],
  ...overrides,
})

type HookState = { current: ReturnType<typeof useTabManagement> }

async function selectNote(result: HookState, overrides: Partial<VaultEntry>) {
  await act(async () => {
    await result.current.handleSelectNote(makeEntry(overrides))
  })
}

async function replaceActiveNote(result: HookState, overrides: Partial<VaultEntry>) {
  await act(async () => {
    await result.current.handleReplaceActiveTab(makeEntry(overrides))
  })
}

async function prefetchResolvedContent(path: string, content: string) {
  const { mockInvoke } = await import('../mock-tauri')
  vi.mocked(mockInvoke).mockResolvedValue(content)
  prefetchNoteContent(path)
  await vi.waitFor(() => expect(vi.mocked(mockInvoke)).toHaveBeenCalledTimes(1))
  return mockInvoke
}

function expectSingleActiveTab(result: HookState, path: string) {
  expect(result.current.tabs).toHaveLength(1)
  expect(result.current.tabs[0].entry.path).toBe(path)
  expect(result.current.activeTabPath).toBe(path)
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('useTabManagement (single-note model)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearPrefetchCache()
  })

  it('starts with no note and null active path', () => {
    const { result } = renderHook(() => useTabManagement())
    expect(result.current.tabs).toEqual([])
    expect(result.current.activeTabPath).toBeNull()
  })

  describe('handleSelectNote', () => {
    it('opens a note and sets it active', async () => {
      const { result } = renderHook(() => useTabManagement())
      await selectNote(result, { path: '/vault/note/a.md' })
      expectSingleActiveTab(result, '/vault/note/a.md')
    })

    it('switches the active path immediately while the next note is still loading', async () => {
      const { mockInvoke } = await import('../mock-tauri')

      let resolveContent: (value: string) => void
      vi.mocked(mockInvoke).mockImplementationOnce(
        () => new Promise<string>((resolve) => { resolveContent = resolve }),
      )

      const { result } = renderHook(() => useTabManagement())
      void act(() => {
        void result.current.handleSelectNote(makeEntry({ path: '/vault/note/pending.md', title: 'Pending' }))
      })

      expect(result.current.activeTabPath).toBe('/vault/note/pending.md')
      expect(result.current.tabs).toEqual([])

      await act(async () => {
        resolveContent!('# Pending content')
      })

      expect(result.current.tabs[0].entry.path).toBe('/vault/note/pending.md')
      expect(result.current.tabs[0].content).toBe('# Pending content')
    })

    it('replaces the current note when selecting a different one', async () => {
      const { result } = renderHook(() => useTabManagement())
      await selectNote(result, { path: '/vault/a.md', title: 'A' })
      await selectNote(result, { path: '/vault/b.md', title: 'B' })
      expectSingleActiveTab(result, '/vault/b.md')
    })

    it('is a no-op when selecting the already-open note', async () => {
      const { result } = renderHook(() => useTabManagement())
      const entry = { path: '/vault/a.md' }
      await selectNote(result, entry)
      await act(async () => {
        await result.current.handleSelectNote(makeEntry(entry))
      })

      expect(result.current.tabs).toHaveLength(1)
    })

    it('handles load content failure gracefully', async () => {
      const { mockInvoke } = await import('../mock-tauri')
      vi.mocked(mockInvoke).mockRejectedValueOnce(new Error('fail'))
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { result } = renderHook(() => useTabManagement())
      await selectNote(result, {})

      expect(result.current.tabs).toHaveLength(1)
      expect(result.current.tabs[0].content).toBe('')
      warnSpy.mockRestore()
    })
  })

  describe('handleReplaceActiveTab', () => {
    it('replaces the current note with a new entry', async () => {
      const { result } = renderHook(() => useTabManagement())
      await selectNote(result, { path: '/vault/a.md', title: 'A' })
      await replaceActiveNote(result, { path: '/vault/b.md', title: 'B' })
      expectSingleActiveTab(result, '/vault/b.md')
    })

    it('is a no-op when replacing with the same entry', async () => {
      const { result } = renderHook(() => useTabManagement())
      const entry = { path: '/vault/a.md' }
      await selectNote(result, entry)
      await act(async () => {
        await result.current.handleReplaceActiveTab(makeEntry(entry))
      })

      expect(result.current.tabs).toHaveLength(1)
    })

    it('opens a note when no note is active', async () => {
      const { result } = renderHook(() => useTabManagement())
      await replaceActiveNote(result, { path: '/vault/a.md' })
      expectSingleActiveTab(result, '/vault/a.md')
    })
  })

  describe('openTabWithContent', () => {
    it('opens a note with pre-loaded content', () => {
      const { result } = renderHook(() => useTabManagement())
      const entry = makeEntry({ path: '/vault/new.md' })

      act(() => {
        result.current.openTabWithContent(entry, '# New note')
      })

      expect(result.current.tabs).toHaveLength(1)
      expect(result.current.tabs[0].content).toBe('# New note')
      expect(result.current.activeTabPath).toBe('/vault/new.md')
    })
  })

  describe('setTabs entry sync', () => {
    it('updates note entry via setTabs mapper (vault entry sync pattern)', async () => {
      const { result } = renderHook(() => useTabManagement())
      const entry = makeEntry({ path: '/vault/a.md', archived: false })

      await act(async () => {
        await result.current.handleSelectNote(entry)
      })

      const freshEntry = { ...entry, archived: true }
      act(() => {
        result.current.setTabs(prev => prev.map(tab =>
          tab.entry.path === freshEntry.path ? { ...tab, entry: freshEntry } : tab
        ))
      })

      expect(result.current.tabs[0].entry.archived).toBe(true)
    })
  })

  describe('closeAllTabs', () => {
    it('clears the note and active path', async () => {
      const { result } = renderHook(() => useTabManagement())
      await selectNote(result, { path: '/vault/a.md' })

      act(() => {
        result.current.closeAllTabs()
      })

      expect(result.current.tabs).toHaveLength(0)
      expect(result.current.activeTabPath).toBeNull()
    })
  })

  describe('content prefetch cache', () => {
    it('prefetch serves content to loadNoteContent (no extra IPC)', async () => {
      const mockInvoke = await prefetchResolvedContent('/vault/note/pre.md', '# Prefetched content')

      const { result } = renderHook(() => useTabManagement())
      await selectNote(result, { path: '/vault/note/pre.md', title: 'Pre' })

      expect(result.current.tabs[0].content).toBe('# Prefetched content')
      expect(vi.mocked(mockInvoke)).toHaveBeenCalledTimes(1)
    })

    it('clearPrefetchCache prevents stale content from being served', async () => {
      const mockInvoke = await prefetchResolvedContent('/vault/note/stale.md', '# Stale')

      clearPrefetchCache()
      vi.mocked(mockInvoke).mockResolvedValue('# Fresh')

      const { result } = renderHook(() => useTabManagement())
      await selectNote(result, { path: '/vault/note/stale.md', title: 'Stale' })

      expect(result.current.tabs[0].content).toBe('# Fresh')
      expect(vi.mocked(mockInvoke)).toHaveBeenCalledTimes(2)
    })

    it('deduplicates concurrent prefetch requests for same path', async () => {
      const { mockInvoke } = await import('../mock-tauri')
      vi.mocked(mockInvoke).mockResolvedValue('# Content')

      prefetchNoteContent('/vault/note/dup.md')
      prefetchNoteContent('/vault/note/dup.md')
      prefetchNoteContent('/vault/note/dup.md')

      await vi.waitFor(() => expect(vi.mocked(mockInvoke)).toHaveBeenCalledTimes(1))
    })

    it('serves refreshed cached content after a save replaces stale prefetched data', async () => {
      const mockInvoke = await prefetchResolvedContent('/vault/note/saved.md', '# Stale prefetched content')

      cacheNoteContent('/vault/note/saved.md', '# Persisted content')

      const { result } = renderHook(() => useTabManagement())
      await selectNote(result, { path: '/vault/note/saved.md', title: 'Saved' })

      expect(result.current.tabs[0].content).toBe('# Persisted content')
      expect(vi.mocked(mockInvoke)).toHaveBeenCalledTimes(1)
    })

    it('activates a warmed note immediately while reusing the cached content', async () => {
      cacheNoteContent('/vault/note/warm.md', '# Warm content')

      const { result } = renderHook(() => useTabManagement())

      act(() => {
        void result.current.handleSelectNote(makeEntry({ path: '/vault/note/warm.md', title: 'Warm' }))
      })

      expect(result.current.activeTabPath).toBe('/vault/note/warm.md')
      expect(result.current.tabs).toHaveLength(1)
      expect(result.current.tabs[0].content).toBe('# Warm content')
    })

    it('reuses cached content when reopening a recently loaded note', async () => {
      const { mockInvoke } = await import('../mock-tauri')
      vi.mocked(mockInvoke)
        .mockResolvedValueOnce('# A content')
        .mockResolvedValueOnce('# B content')

      const { result } = renderHook(() => useTabManagement())
      await selectNote(result, { path: '/vault/a.md', title: 'A' })
      await selectNote(result, { path: '/vault/b.md', title: 'B' })
      await selectNote(result, { path: '/vault/a.md', title: 'A again' })

      expect(result.current.tabs[0].entry.path).toBe('/vault/a.md')
      expect(result.current.tabs[0].content).toBe('# A content')
      expect(vi.mocked(mockInvoke)).toHaveBeenCalledTimes(2)
    })

    it('deduplicates a late prefetch after note opening already started', async () => {
      const { mockInvoke } = await import('../mock-tauri')

      let resolveContent!: (value: string) => void
      vi.mocked(mockInvoke).mockImplementationOnce(
        () => new Promise<string>((resolve) => { resolveContent = resolve }),
      )

      const { result } = renderHook(() => useTabManagement())

      await act(async () => {
        void result.current.handleSelectNote(makeEntry({ path: '/vault/note/rapid.md', title: 'Rapid' }))
        prefetchNoteContent('/vault/note/rapid.md')
        await Promise.resolve()
      })

      expect(vi.mocked(mockInvoke)).toHaveBeenCalledTimes(1)

      await act(async () => {
        resolveContent('# Rapid content')
        await Promise.resolve()
      })

      expect(result.current.tabs[0].content).toBe('# Rapid content')
    })
  })

  describe('rapid switching safety', () => {
    it('only activates the last note when switching rapidly', async () => {
      const { mockInvoke } = await import('../mock-tauri')

      let resolveA: (v: string) => void
      let resolveB: (v: string) => void
      vi.mocked(mockInvoke)
        .mockImplementationOnce(() => new Promise<string>((r) => { resolveA = r as (v: string) => void }))
        .mockImplementationOnce(() => new Promise<string>((r) => { resolveB = r as (v: string) => void }))

      const { result } = renderHook(() => useTabManagement())

      let selectADone = false
      await act(async () => {
        result.current.handleSelectNote(makeEntry({ path: '/vault/a.md', title: 'A' })).then(() => { selectADone = true })
        await Promise.resolve()
      })

      let selectBDone = false
      await act(async () => {
        result.current.handleSelectNote(makeEntry({ path: '/vault/b.md', title: 'B' })).then(() => { selectBDone = true })
        await Promise.resolve()
      })

      await act(async () => { resolveB!('# B content') })
      await act(async () => { resolveA!('# A content') })

      await vi.waitFor(() => expect(selectADone && selectBDone).toBe(true))

      expect(result.current.activeTabPath).toBe('/vault/b.md')
    })

    it('waits for beforeNavigate before switching away from the current note', async () => {
      const beforeNavigate = vi.fn(() => createDeferred<void>().promise)
      const deferred = createDeferred<void>()
      beforeNavigate.mockReturnValueOnce(deferred.promise)

      const { result } = renderHook(() => useTabManagement({ beforeNavigate }))
      await selectNote(result, { path: '/vault/a.md', title: 'A' })

      let replaceDone = false
      await act(async () => {
        result.current.handleReplaceActiveTab(makeEntry({ path: '/vault/b.md', title: 'B' }))
          .then(() => { replaceDone = true })
        await Promise.resolve()
      })

      expect(beforeNavigate).toHaveBeenCalledWith('/vault/a.md', '/vault/b.md')
      expect(result.current.activeTabPath).toBe('/vault/a.md')
      expect(replaceDone).toBe(false)

      await act(async () => {
        deferred.resolve(undefined)
        await Promise.resolve()
      })

      await vi.waitFor(() => expect(replaceDone).toBe(true))
      expectSingleActiveTab(result, '/vault/b.md')
    })

    it('keeps only the latest target when note switches overlap during beforeNavigate', async () => {
      const first = createDeferred<void>()
      const second = createDeferred<void>()
      const beforeNavigate = vi.fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)

      const { result } = renderHook(() => useTabManagement({ beforeNavigate }))
      await selectNote(result, { path: '/vault/a.md', title: 'A' })

      let switchToBDone = false
      await act(async () => {
        result.current.handleReplaceActiveTab(makeEntry({ path: '/vault/b.md', title: 'B' }))
          .then(() => { switchToBDone = true })
        await Promise.resolve()
      })

      let switchToCDone = false
      await act(async () => {
        result.current.handleReplaceActiveTab(makeEntry({ path: '/vault/c.md', title: 'C' }))
          .then(() => { switchToCDone = true })
        await Promise.resolve()
      })

      await act(async () => {
        first.resolve(undefined)
        await Promise.resolve()
      })
      expect(result.current.activeTabPath).toBe('/vault/a.md')

      await act(async () => {
        second.resolve(undefined)
        await Promise.resolve()
      })

      await vi.waitFor(() => expect(switchToBDone && switchToCDone).toBe(true))
      expect(result.current.activeTabPath).toBe('/vault/c.md')
    })

    it('keeps the current note active when beforeNavigate fails', async () => {
      const beforeNavigate = vi.fn().mockRejectedValueOnce(new Error('save failed'))
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { result } = renderHook(() => useTabManagement({ beforeNavigate }))
      await selectNote(result, { path: '/vault/a.md', title: 'A' })

      await act(async () => {
        await result.current.handleReplaceActiveTab(makeEntry({ path: '/vault/b.md', title: 'B' }))
      })

      expect(result.current.activeTabPath).toBe('/vault/a.md')
      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to persist note before navigation:',
        expect.any(Error),
      )
      warnSpy.mockRestore()
    })
  })
})
