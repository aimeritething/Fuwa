import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Tab } from '../types'
import { noteEntryForPath } from '../utils/noteEntry'
import { useSession } from './useSession'

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

const A = '/n/a.md'
const B = '/n/b.md'
const tab = (path: string): Tab => ({ entry: noteEntryForPath(path, ''), content: '' })

const STORED_SESSION = {
  version: 1,
  folder: null,
  openEditors: [{ path: A, mode: 'rich' }, { path: B, mode: 'rich' }],
  activePath: B,
  theme: 'dark',
  sidebar: { collapsed: false, width: 260 },
  window: { x: 10, y: 20, width: 1200, height: 800 },
}

function answerWith(stored: unknown) {
  runtime.invoke.mockImplementation(async (cmd) => (cmd === 'read_session' ? stored : undefined))
}

const sessionWrites = () =>
  runtime.invoke.mock.calls.filter(([cmd]) => cmd === 'update_session').map(([, args]) => args?.session)

describe('useSession', () => {
  beforeEach(() => {
    runtime.invoke.mockReset()
  })

  it('restores the stored Tabs and active Tab on launch', async () => {
    answerWith(STORED_SESSION)
    const restoreOpenEditors = vi.fn().mockResolvedValue(undefined)

    const { result } = renderHook(() => useSession({ tabs: [], activeTabPath: null, restoreOpenEditors }))

    await waitFor(() => expect(result.current.restored).toBe(true))
    expect(restoreOpenEditors).toHaveBeenCalledWith(
      [{ path: A, mode: 'rich' }, { path: B, mode: 'rich' }],
      B,
    )
  })

  it('ignores a Session with an unknown version and rewrites it in the current schema', async () => {
    answerWith({ version: 7, openEditors: [{ path: A }] })
    const restoreOpenEditors = vi.fn()

    const { result } = renderHook(() => useSession({ tabs: [], activeTabPath: null, restoreOpenEditors }))

    await waitFor(() => expect(result.current.restored).toBe(true))
    expect(restoreOpenEditors).not.toHaveBeenCalled()
    await waitFor(() => expect(sessionWrites()).toEqual([
      {
        version: 1,
        folder: null,
        openEditors: [],
        activePath: null,
        theme: 'dark',
        sidebar: { collapsed: false, width: 260 },
      },
    ]))
  })

  it('writes the open Tabs in order and the active Tab whenever they change, but not before the restore', async () => {
    let releaseRead: (value: unknown) => void = () => {}
    runtime.invoke.mockImplementation((cmd) =>
      cmd === 'read_session' ? new Promise((resolve) => { releaseRead = resolve }) : Promise.resolve(undefined),
    )
    const restoreOpenEditors = vi.fn().mockResolvedValue(undefined)
    const { result, rerender } = renderHook(
      (props: { tabs: Tab[]; activeTabPath: string | null }) => useSession({ ...props, restoreOpenEditors }),
      { initialProps: { tabs: [tab(A)], activeTabPath: A } },
    )

    expect(sessionWrites()).toEqual([])

    await act(async () => {
      releaseRead(null)
    })
    await waitFor(() => expect(result.current.restored).toBe(true))
    rerender({ tabs: [tab(A), tab(B)], activeTabPath: B })

    await waitFor(() => expect(sessionWrites().at(-1)).toMatchObject({
      version: 1,
      openEditors: [{ path: A, mode: 'rich' }, { path: B, mode: 'rich' }],
      activePath: B,
    }))
  })

  it('starts fresh and restores nothing when the read fails', async () => {
    runtime.invoke.mockImplementation(async (cmd) => {
      if (cmd === 'read_session') throw new Error('No mock handler for command: read_session')
      return undefined
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const restoreOpenEditors = vi.fn()

    const { result } = renderHook(() => useSession({ tabs: [], activeTabPath: null, restoreOpenEditors }))

    await waitFor(() => expect(result.current.restored).toBe(true))
    expect(restoreOpenEditors).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
