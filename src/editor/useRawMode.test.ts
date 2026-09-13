import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCallback, useState } from 'react'
import type { EditorMode } from '@/types'
import { useRawMode } from './useRawMode'

type Extra = { onFlushPending?: () => Promise<boolean>; onBeforeRawEnd?: () => void }

/** The hook over a per-Tab mode store, the way the Tab state holds it in the app. */
function useRawModeOverTabs(path: string | null, extra: Extra) {
  const [modes, setModes] = useState<Record<string, EditorMode>>({})
  const setMode = useCallback((target: string, mode: EditorMode) => {
    setModes((prev) => ({ ...prev, [target]: mode }))
  }, [])
  const mode = path === null ? null : modes[path] ?? 'rich'
  return useRawMode({ activeTabPath: path, mode, setMode, ...extra })
}

describe('useRawMode', () => {
  function renderRawHook(activeTabPath: string | null = '/note.md', extra: Extra = {}) {
    const onFlushPending = extra.onFlushPending ?? vi.fn().mockResolvedValue(true)
    const rendered = renderHook(
      ({ path }) => useRawModeOverTabs(path, { ...extra, onFlushPending }),
      { initialProps: { path: activeTabPath } },
    )
    return { ...rendered, onFlushPending }
  }

  it('starts with raw mode off', () => {
    const { result } = renderRawHook()
    expect(result.current.rawMode).toBe(false)
  })

  it('toggles raw mode on', async () => {
    const { result } = renderRawHook()

    await act(async () => { await result.current.handleToggleRaw() })

    expect(result.current.rawMode).toBe(true)
  })

  it('flushes pending edits when activating raw mode', async () => {
    const { result, onFlushPending } = renderRawHook()

    await act(async () => { await result.current.handleToggleRaw() })

    expect(onFlushPending).toHaveBeenCalledOnce()
  })

  it('does not flush pending edits when deactivating raw mode', async () => {
    const { result, onFlushPending } = renderRawHook()

    await act(async () => { await result.current.handleToggleRaw() })
    vi.mocked(onFlushPending).mockClear()

    await act(async () => { await result.current.handleToggleRaw() })

    expect(onFlushPending).not.toHaveBeenCalled()
  })

  it('toggles raw mode off when already on', async () => {
    const { result } = renderRawHook()

    await act(async () => { await result.current.handleToggleRaw() })
    expect(result.current.rawMode).toBe(true)

    await act(async () => { await result.current.handleToggleRaw() })
    expect(result.current.rawMode).toBe(false)
  })

  it('remembers the mode per Tab: another Tab opens Rich, and the Raw Tab is Raw again on return', async () => {
    const { result, rerender } = renderRawHook('/note-a.md')

    await act(async () => { await result.current.handleToggleRaw() })
    expect(result.current.rawMode).toBe(true)

    rerender({ path: '/note-b.md' })
    expect(result.current.rawMode).toBe(false)

    rerender({ path: '/note-a.md' })
    expect(result.current.rawMode).toBe(true)
  })

  it('works without onFlushPending callback', async () => {
    const { result } = renderHook(() => useRawModeOverTabs('/note.md', {}))

    await act(async () => { await result.current.handleToggleRaw() })

    expect(result.current.rawMode).toBe(true)
  })

  it('does nothing when activeTabPath is null', async () => {
    const { result, onFlushPending } = renderRawHook(null)

    await act(async () => { await result.current.handleToggleRaw() })

    expect(result.current.rawMode).toBe(false)
    expect(onFlushPending).not.toHaveBeenCalled()
  })

  it('calls onBeforeRawEnd when deactivating raw mode', async () => {
    const onBeforeRawEnd = vi.fn()
    const { result } = renderRawHook('/note.md', { onBeforeRawEnd })

    await act(async () => { await result.current.handleToggleRaw() })
    expect(result.current.rawMode).toBe(true)

    await act(async () => { await result.current.handleToggleRaw() })

    expect(onBeforeRawEnd).toHaveBeenCalledOnce()
    expect(result.current.rawMode).toBe(false)
  })

  it('does not call onBeforeRawEnd when activating raw mode', async () => {
    const onBeforeRawEnd = vi.fn()
    const { result } = renderRawHook('/note.md', { onBeforeRawEnd })

    await act(async () => { await result.current.handleToggleRaw() })

    expect(onBeforeRawEnd).not.toHaveBeenCalled()
  })

  it('reads a Raw mode the Tab already carries, as a restored Session gives it', () => {
    const { result } = renderHook(() => useRawMode({ activeTabPath: '/note.md', mode: 'raw', setMode: vi.fn() }))
    expect(result.current.rawMode).toBe(true)
  })
})
