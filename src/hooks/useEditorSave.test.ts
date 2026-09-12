import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEditorSave } from './useEditorSave'

const mockInvokeFn = vi.fn<(cmd: string, args?: Record<string, unknown>) => Promise<null>>(() => Promise.resolve(null))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => mockInvokeFn(cmd, args),
  updateMockContent: vi.fn(),
}))

describe('useEditorSave', () => {
  let setTabs: Mock

  beforeEach(() => {
    setTabs = vi.fn()
    mockInvokeFn.mockReset()
    mockInvokeFn.mockResolvedValue(null)
  })

  function renderSaveHook() {
    return renderHook(() => useEditorSave({ setTabs }))
  }

  it('savePendingForPath writes the buffered content of that path only', async () => {
    const { result } = renderSaveHook()

    act(() => {
      result.current.handleContentChange('/test/note-a.md', 'content A')
    })

    let saved = true
    await act(async () => {
      saved = await result.current.savePendingForPath('/test/note-b.md')
    })
    expect(saved).toBe(false)
    expect(mockInvokeFn).not.toHaveBeenCalled()

    await act(async () => {
      saved = await result.current.savePendingForPath('/test/note-a.md')
    })
    expect(saved).toBe(true)
    expect(mockInvokeFn).toHaveBeenCalledWith('save_note_content', {
      path: '/test/note-a.md',
      content: 'content A',
    })
  })

  it('savePendingForPath resolves false once the buffer has been written', async () => {
    const { result } = renderSaveHook()

    act(() => {
      result.current.handleContentChange('/test/note.md', 'edited')
    })
    await act(async () => {
      await result.current.savePendingForPath('/test/note.md')
    })

    let saved = true
    await act(async () => {
      saved = await result.current.savePendingForPath('/test/note.md')
    })
    expect(saved).toBe(false)
    expect(mockInvokeFn).toHaveBeenCalledTimes(1)
  })

  it('hasPendingSave answers for the buffered path until its write lands', async () => {
    const { result } = renderSaveHook()

    expect(result.current.hasPendingSave('/test/note.md')).toBe(false)
    act(() => {
      result.current.handleContentChange('/test/note.md', 'edited')
    })
    expect(result.current.hasPendingSave('/test/note.md')).toBe(true)
    expect(result.current.hasPendingSave('/test/other.md')).toBe(false)

    await act(async () => {
      await result.current.savePendingForPath('/test/note.md')
    })
    expect(result.current.hasPendingSave('/test/note.md')).toBe(false)
  })

  it('coalesces overlapping savePendingForPath calls for the same buffered content', async () => {
    let resolveSave!: (value: null) => void
    mockInvokeFn.mockReturnValue(new Promise<null>((resolve) => { resolveSave = resolve }))
    const { result } = renderSaveHook()

    act(() => {
      result.current.handleContentChange('/test/note-a.md', 'content A')
    })

    let firstSave!: Promise<boolean>
    let secondSave!: Promise<boolean>
    await act(async () => {
      firstSave = result.current.savePendingForPath('/test/note-a.md')
      secondSave = result.current.savePendingForPath('/test/note-a.md')
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockInvokeFn).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveSave(null)
      await expect(Promise.all([firstSave, secondSave])).resolves.toEqual([true, true])
    })
  })

  it('a buffer that arrives while an older write is in flight is not overwritten by it', async () => {
    let resolveFirstSave!: () => void
    const firstWrite = new Promise<null>((resolve) => { resolveFirstSave = () => resolve(null) })
    mockInvokeFn.mockImplementationOnce(() => firstWrite).mockResolvedValue(null)
    const onNotePersisted = vi.fn()
    const { result } = renderHook(() => useEditorSave({ setTabs, onNotePersisted }))

    act(() => {
      result.current.handleContentChange('/test/note.md', 'draft 1')
    })
    let firstSave!: Promise<boolean>
    await act(async () => {
      firstSave = result.current.savePendingForPath('/test/note.md')
      await Promise.resolve()
    })
    expect(mockInvokeFn).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.handleContentChange('/test/note.md', 'draft 2')
    })
    const tabsWithDraft2 = [{ entry: { path: '/test/note.md' }, content: 'draft 2' }]
    await act(async () => {
      resolveFirstSave()
      await expect(firstSave).resolves.toBe(false)
    })

    // The landed write of draft 1 neither touched the Tab nor cleared the buffer.
    const lastUpdater = setTabs.mock.calls.at(-1)?.[0]
    expect(lastUpdater(tabsWithDraft2)).toBe(tabsWithDraft2)
    expect(onNotePersisted).not.toHaveBeenCalled()
    expect(result.current.hasPendingSave('/test/note.md')).toBe(true)

    await act(async () => {
      await result.current.savePendingForPath('/test/note.md')
    })
    expect(mockInvokeFn).toHaveBeenCalledTimes(2)
    expect(mockInvokeFn).toHaveBeenLastCalledWith('save_note_content', {
      path: '/test/note.md',
      content: 'draft 2',
    })
    expect(onNotePersisted).toHaveBeenCalledWith('/test/note.md', 'draft 2')
  })

  it('handleContentChange syncs content to tab state immediately', () => {
    const { result } = renderSaveHook()

    act(() => {
      result.current.handleContentChange('/test/note.md', '---\ntitle: T\n---\n\n# T\n\nLive edits')
    })

    // setTabs runs on every content change, not only after a write.
    expect(setTabs).toHaveBeenCalled()
    const updater = setTabs.mock.calls[0][0]
    const tabs = [{ entry: { path: '/test/note.md' }, content: 'stale' }]
    const updated = updater(tabs)
    expect(updated[0].content).toBe('---\ntitle: T\n---\n\n# T\n\nLive edits')
  })

  it('does not replace current tab state again when saving content already synced from editor changes', async () => {
    const { result } = renderSaveHook()
    const path = '/test/note.md'
    const content = '---\ntitle: T\n---\n\n# T\n\nLive edits'

    act(() => {
      result.current.handleContentChange(path, content)
    })

    const liveUpdater = setTabs.mock.calls.at(-1)?.[0]
    const initialTabs = [{ entry: { path }, content: 'stale' }]
    const currentTabs = liveUpdater(initialTabs)

    await act(async () => {
      await result.current.savePendingForPath(path)
    })

    const saveUpdater = setTabs.mock.calls.at(-1)?.[0]
    expect(saveUpdater(currentTabs)).toBe(currentTabs)
  })

  it('writes the edited body, not the original, and the Tab shows it (regression)', async () => {
    const { result } = renderSaveHook()

    const original = '---\ntitle: My Note\n---\n\n# My Note\n\nOriginal body'
    const edited = '---\ntitle: My Note\n---\n\n# My Note\n\nEdited body with changes'

    act(() => {
      result.current.handleContentChange('/vault/note.md', edited)
    })

    await act(async () => {
      await result.current.savePendingForPath('/vault/note.md')
    })

    expect(mockInvokeFn).toHaveBeenCalledWith('save_note_content', {
      path: '/vault/note.md',
      content: edited,
    })

    expect(setTabs).toHaveBeenCalled()
    const tabUpdater = setTabs.mock.calls[0][0]
    const fakeTabs = [{ entry: { path: '/vault/note.md' }, content: original }]
    const updatedTabs = tabUpdater(fakeTabs)
    expect(updatedTabs[0].content).toBe(edited)
  })

  it('calls onNotePersisted with path and content after writing the buffer', async () => {
    const onNotePersisted = vi.fn()
    const { result } = renderHook(() => useEditorSave({ setTabs, onNotePersisted }))

    act(() => {
      result.current.handleContentChange('/vault/theme/default.md', '---\nbackground: "#FFD700"\n---\n')
    })

    await act(async () => {
      await result.current.savePendingForPath('/vault/theme/default.md')
    })

    expect(onNotePersisted).toHaveBeenCalledWith(
      '/vault/theme/default.md',
      '---\nbackground: "#FFD700"\n---\n',
    )
  })

  it('successive edits and writes persist each version correctly', async () => {
    const { result } = renderSaveHook()

    act(() => {
      result.current.handleContentChange('/vault/note.md', 'version 1')
    })
    await act(async () => {
      await result.current.savePendingForPath('/vault/note.md')
    })
    expect(mockInvokeFn).toHaveBeenLastCalledWith('save_note_content', {
      path: '/vault/note.md',
      content: 'version 1',
    })

    act(() => {
      result.current.handleContentChange('/vault/note.md', 'version 2')
    })
    await act(async () => {
      await result.current.savePendingForPath('/vault/note.md')
    })
    expect(mockInvokeFn).toHaveBeenLastCalledWith('save_note_content', {
      path: '/vault/note.md',
      content: 'version 2',
    })
  })

  describe('the boundary root (Fuwa: every write names its root)', () => {
    it('sends the persistence scope that contains the path as vaultPath', async () => {
      const { result } = renderHook(() =>
        useEditorSave({ setTabs, persistenceScope: ['/vault-a', '/vault-b'] })
      )

      act(() => {
        result.current.handleContentChange('/vault-b/note.md', '# B')
      })
      await act(async () => {
        await result.current.savePendingForPath('/vault-b/note.md')
      })

      expect(mockInvokeFn).toHaveBeenCalledWith('save_note_content', {
        path: '/vault-b/note.md',
        content: '# B',
        vaultPath: '/vault-b',
      })
    })

    it('omits vaultPath when no scope is configured', async () => {
      const { result } = renderSaveHook()

      act(() => {
        result.current.handleContentChange('/anywhere/note.md', '# Anywhere')
      })
      await act(async () => {
        await result.current.savePendingForPath('/anywhere/note.md')
      })

      expect(mockInvokeFn).toHaveBeenCalledWith('save_note_content', {
        path: '/anywhere/note.md',
        content: '# Anywhere',
      })
      expect(mockInvokeFn.mock.calls[0][1]).not.toHaveProperty('vaultPath')
    })

    it('drops a report for a path outside the scope', async () => {
      const { result } = renderHook(() => useEditorSave({ setTabs, persistenceScope: '/vault-a' }))

      act(() => {
        result.current.handleContentChange('/elsewhere/note.md', '# Elsewhere')
      })

      expect(setTabs).not.toHaveBeenCalled()
      expect(result.current.hasPendingSave('/elsewhere/note.md')).toBe(false)
      await act(async () => {
        await result.current.savePendingForPath('/elsewhere/note.md')
      })
      expect(mockInvokeFn).not.toHaveBeenCalled()
    })

    it('clears the buffer when the scope changes', async () => {
      const { result, rerender } = renderHook(
        ({ persistenceScope }: { persistenceScope: string }) => useEditorSave({ setTabs, persistenceScope }),
        { initialProps: { persistenceScope: '/vault-a' } },
      )

      act(() => {
        result.current.handleContentChange('/vault-a/note.md', '# A')
      })
      expect(result.current.hasPendingSave('/vault-a/note.md')).toBe(true)

      rerender({ persistenceScope: '/vault-b' })

      expect(result.current.hasPendingSave('/vault-a/note.md')).toBe(false)
      await act(async () => {
        await result.current.savePendingForPath('/vault-a/note.md')
      })
      expect(mockInvokeFn).not.toHaveBeenCalled()
    })
  })
})

describe('the Write failure paths (Fuwa: the error bar)', () => {
  let setTabs: Mock
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    setTabs = vi.fn()
    mockInvokeFn.mockReset()
    mockInvokeFn.mockResolvedValue(null)
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  function renderSaveHook() {
    return renderHook(() => useEditorSave({ setTabs }))
  }

  it('a refused write rejects savePendingForPath, keeps the buffer, and the next call retries it', async () => {
    mockInvokeFn.mockRejectedValueOnce(new Error('Failed to write file: Permission denied (os error 13)'))
    const onNotePersisted = vi.fn()
    const { result } = renderHook(() => useEditorSave({ setTabs, onNotePersisted }))

    act(() => {
      result.current.handleContentChange('/n/a.md', '# A\n\nKept.')
    })
    await act(async () => {
      await expect(result.current.savePendingForPath('/n/a.md')).rejects.toThrow('Permission denied')
    })
    expect(onNotePersisted).not.toHaveBeenCalled()
    expect(result.current.hasPendingSave('/n/a.md')).toBe(true)

    let saved = false
    await act(async () => {
      saved = await result.current.savePendingForPath('/n/a.md')
    })

    expect(saved).toBe(true)
    expect(mockInvokeFn).toHaveBeenLastCalledWith('save_note_content', { path: '/n/a.md', content: '# A\n\nKept.' })
    expect(onNotePersisted).toHaveBeenCalledWith('/n/a.md', '# A\n\nKept.')
  })

  it('discardPending drops the buffered edits of that Document so nothing is written for it', async () => {
    mockInvokeFn.mockRejectedValueOnce(new Error('Permission denied'))
    const { result } = renderSaveHook()

    act(() => {
      result.current.handleContentChange('/n/a.md', '# A\n\nDiscarded.')
    })
    await act(async () => {
      await result.current.savePendingForPath('/n/a.md').catch(() => {})
    })

    act(() => {
      result.current.discardPending('/n/a.md')
    })
    expect(result.current.hasPendingSave('/n/a.md')).toBe(false)
    let saved = true
    await act(async () => {
      saved = await result.current.savePendingForPath('/n/a.md')
    })

    expect(saved).toBe(false)
    expect(mockInvokeFn).toHaveBeenCalledTimes(1)
  })

  it('discardPending leaves another Document\'s buffered edits alone', async () => {
    const { result } = renderSaveHook()

    act(() => {
      result.current.handleContentChange('/n/b.md', '# B')
      result.current.discardPending('/n/a.md')
    })
    await act(async () => {
      await result.current.savePendingForPath('/n/b.md')
    })

    expect(mockInvokeFn).toHaveBeenCalledWith('save_note_content', { path: '/n/b.md', content: '# B' })
  })
})
