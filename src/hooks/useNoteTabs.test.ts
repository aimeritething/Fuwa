import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { subscribeNoteContentResolved, type NoteContentResolvedEvent } from './noteContentCache'
import { useNoteTabs } from './useNoteTabs'

const runtime = vi.hoisted(() => ({
  invoke: vi.fn<(cmd: string, args?: Record<string, unknown>) => Promise<unknown>>(),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => runtime.invoke(cmd, args),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

describe('useNoteTabs', () => {
  beforeEach(() => {
    runtime.invoke.mockReset()
  })

  it('opens a Document by reading it through the boundary with its own directory as the root', async () => {
    runtime.invoke.mockResolvedValue('# Welcome\n')
    const { result } = renderHook(() => useNoteTabs())

    await act(async () => {
      await result.current.openNote('/Users/fuwa/Documents/Notes/Welcome.md')
    })

    expect(runtime.invoke).toHaveBeenCalledWith('get_note_content', {
      path: '/Users/fuwa/Documents/Notes/Welcome.md',
      vaultPath: '/Users/fuwa/Documents/Notes',
    })
    expect(result.current.activeTabPath).toBe('/Users/fuwa/Documents/Notes/Welcome.md')
    expect(result.current.activeTab?.entry.filename).toBe('Welcome.md')
    expect(result.current.activeTab?.content).toBe('# Welcome\n')
    expect(result.current.tabs).toHaveLength(1)
  })

  it('keeps one Document at a time: opening another replaces the first', async () => {
    runtime.invoke.mockResolvedValueOnce('# A\n').mockResolvedValueOnce('# B\n')
    const { result } = renderHook(() => useNoteTabs())

    await act(async () => {
      await result.current.openNote('/n/a.md')
      await result.current.openNote('/n/b.md')
    })

    expect(result.current.tabs.map((tab) => tab.entry.path)).toEqual(['/n/b.md'])
    expect(result.current.activeTabPath).toBe('/n/b.md')
  })

  it('announces the opened content on the note-content bus for the active Document', async () => {
    runtime.invoke.mockResolvedValue('# Welcome\n')
    const events: NoteContentResolvedEvent[] = []
    const unsubscribe = subscribeNoteContentResolved((event) => events.push(event))
    const { result } = renderHook(() => useNoteTabs())

    await act(async () => {
      await result.current.openNote('/n/welcome.md')
    })
    unsubscribe()

    expect(events).toEqual([
      expect.objectContaining({ path: '/n/welcome.md', content: '# Welcome\n', parsedBlockPreload: true }),
    ])
    expect(events[0].entry?.path).toBe('/n/welcome.md')
  })

  it('leaves nothing open when the read fails, and surfaces the error', async () => {
    runtime.invoke.mockRejectedValue(new Error('File does not exist'))
    const { result } = renderHook(() => useNoteTabs())

    await expect(act(() => result.current.openNote('/n/missing.md'))).rejects.toThrow('File does not exist')

    expect(result.current.tabs).toEqual([])
    expect(result.current.activeTabPath).toBeNull()
  })

  it('lets the save hook replace the open Document\'s content through setTabs', async () => {
    runtime.invoke.mockResolvedValue('# A\n')
    const { result } = renderHook(() => useNoteTabs())
    await act(async () => {
      await result.current.openNote('/n/a.md')
    })

    act(() => {
      result.current.setTabs((tabs) => tabs.map((tab) => ({ ...tab, content: '# A\n\nEdited\n' })))
    })

    expect(result.current.activeTab?.content).toBe('# A\n\nEdited\n')
  })
})
