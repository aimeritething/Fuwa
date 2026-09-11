import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ThemeMode } from '../lib/themeMode'
import type { Tab } from '../types'
import { noteEntryForPath } from '../utils/noteEntry'
import { DEFAULT_SESSION_SIDEBAR } from '../utils/sessionSchema'
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
  const restoreTheme = vi.fn()
  const restoreSidebar = vi.fn()

  beforeEach(() => {
    runtime.invoke.mockReset()
    restoreTheme.mockReset()
    restoreSidebar.mockReset()
  })

  it('restores the stored Tabs and active Tab on launch', async () => {
    answerWith(STORED_SESSION)
    const restoreOpenEditors = vi.fn().mockResolvedValue(undefined)

    const { result } = renderHook(() => useSession({ tabs: [], activeTabPath: null, theme: 'dark', restoreOpenEditors, restoreTheme, sidebar: DEFAULT_SESSION_SIDEBAR, restoreSidebar }))

    await waitFor(() => expect(result.current.restored).toBe(true))
    expect(restoreOpenEditors).toHaveBeenCalledWith(
      [{ path: A, mode: 'rich' }, { path: B, mode: 'rich' }],
      B,
    )
  })

  it('ignores a Session with an unknown version and rewrites it in the current schema', async () => {
    answerWith({ version: 7, openEditors: [{ path: A }] })
    const restoreOpenEditors = vi.fn()

    const { result } = renderHook(() => useSession({ tabs: [], activeTabPath: null, theme: 'dark', restoreOpenEditors, restoreTheme, sidebar: DEFAULT_SESSION_SIDEBAR, restoreSidebar }))

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
      (props: { tabs: Tab[]; activeTabPath: string | null; theme: ThemeMode }) =>
        useSession({ ...props, restoreOpenEditors, restoreTheme, sidebar: DEFAULT_SESSION_SIDEBAR, restoreSidebar }),
      { initialProps: { tabs: [tab(A)], activeTabPath: A, theme: 'dark' as ThemeMode } },
    )

    expect(sessionWrites()).toEqual([])

    await act(async () => {
      releaseRead(null)
    })
    await waitFor(() => expect(result.current.restored).toBe(true))
    rerender({ tabs: [tab(A), tab(B)], activeTabPath: B, theme: 'dark' })

    await waitFor(() => expect(sessionWrites().at(-1)).toMatchObject({
      version: 1,
      openEditors: [{ path: A, mode: 'rich' }, { path: B, mode: 'rich' }],
      activePath: B,
    }))
  })

  it('writes each Document with its own mode and rewrites the file when a mode changes (AIM-381)', async () => {
    answerWith(null)
    const restoreOpenEditors = vi.fn().mockResolvedValue(undefined)
    const { result, rerender } = renderHook(
      (props: { tabs: Tab[] }) =>
        useSession({ ...props, activeTabPath: A, theme: 'dark', restoreOpenEditors, restoreTheme, sidebar: DEFAULT_SESSION_SIDEBAR, restoreSidebar }),
      { initialProps: { tabs: [{ ...tab(A), mode: 'raw' as const }, tab(B)] } },
    )
    await waitFor(() => expect(result.current.restored).toBe(true))
    await waitFor(() => expect(sessionWrites().at(-1)).toMatchObject({
      openEditors: [{ path: A, mode: 'raw' }, { path: B, mode: 'rich' }],
    }))
    const writesBefore = sessionWrites().length

    rerender({ tabs: [{ ...tab(A), mode: 'rich' as const }, tab(B)] })

    await waitFor(() => expect(sessionWrites().length).toBe(writesBefore + 1))
    expect(sessionWrites().at(-1)).toMatchObject({
      openEditors: [{ path: A, mode: 'rich' }, { path: B, mode: 'rich' }],
    })
  })

  it('starts fresh and restores nothing when the read fails', async () => {
    runtime.invoke.mockImplementation(async (cmd) => {
      if (cmd === 'read_session') throw new Error('No mock handler for command: read_session')
      return undefined
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const restoreOpenEditors = vi.fn()

    const { result } = renderHook(() => useSession({ tabs: [], activeTabPath: null, theme: 'dark', restoreOpenEditors, restoreTheme, sidebar: DEFAULT_SESSION_SIDEBAR, restoreSidebar }))

    await waitFor(() => expect(result.current.restored).toBe(true))
    expect(restoreOpenEditors).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('restores the stored appearance on launch and writes it back with the Tabs', async () => {
    answerWith({ ...STORED_SESSION, theme: 'light' })
    const restoreOpenEditors = vi.fn().mockResolvedValue(undefined)

    const { result } = renderHook(() => useSession({ tabs: [], activeTabPath: null, theme: 'light', restoreOpenEditors, restoreTheme, sidebar: DEFAULT_SESSION_SIDEBAR, restoreSidebar }))

    await waitFor(() => expect(result.current.restored).toBe(true))
    expect(restoreTheme).toHaveBeenCalledWith('light')
    await waitFor(() => expect(sessionWrites().at(-1)).toMatchObject({ theme: 'light' }))
  })

  it('leaves the appearance alone when there is no Session to restore', async () => {
    answerWith(null)
    const restoreOpenEditors = vi.fn()

    const { result } = renderHook(() => useSession({ tabs: [], activeTabPath: null, theme: 'dark', restoreOpenEditors, restoreTheme, sidebar: DEFAULT_SESSION_SIDEBAR, restoreSidebar }))

    await waitFor(() => expect(result.current.restored).toBe(true))
    expect(restoreTheme).not.toHaveBeenCalled()
  })

  it('writes the appearance whenever it changes', async () => {
    answerWith(null)
    const restoreOpenEditors = vi.fn()
    const { result, rerender } = renderHook(
      (props: { theme: ThemeMode }) => useSession({ tabs: [], activeTabPath: null, ...props, restoreOpenEditors, restoreTheme, sidebar: DEFAULT_SESSION_SIDEBAR, restoreSidebar }),
      { initialProps: { theme: 'dark' as ThemeMode } },
    )

    await waitFor(() => expect(result.current.restored).toBe(true))
    rerender({ theme: 'system' })

    await waitFor(() => expect(sessionWrites().at(-1)).toMatchObject({ version: 1, theme: 'system' }))
  })

  it('restores the stored sidebar state on launch and writes it back with the Tabs', async () => {
    answerWith({ ...STORED_SESSION, sidebar: { collapsed: true, width: 320 } })
    const restoreOpenEditors = vi.fn().mockResolvedValue(undefined)

    const { result } = renderHook(() => useSession({
      tabs: [], activeTabPath: null, theme: 'dark', restoreOpenEditors, restoreTheme,
      sidebar: { collapsed: true, width: 320 }, restoreSidebar,
    }))

    await waitFor(() => expect(result.current.restored).toBe(true))
    expect(restoreSidebar).toHaveBeenCalledWith({ collapsed: true, width: 320 })
    await waitFor(() => expect(sessionWrites().at(-1)).toMatchObject({ sidebar: { collapsed: true, width: 320 } }))
  })

  it('writes the sidebar state whenever it collapses or is resized', async () => {
    answerWith(null)
    const restoreOpenEditors = vi.fn()
    const { result, rerender } = renderHook(
      (props: { sidebar: { collapsed: boolean; width: number } }) =>
        useSession({ tabs: [], activeTabPath: null, theme: 'dark', ...props, restoreOpenEditors, restoreTheme, restoreSidebar }),
      { initialProps: { sidebar: { collapsed: false, width: 260 } } },
    )

    await waitFor(() => expect(result.current.restored).toBe(true))
    expect(restoreSidebar).not.toHaveBeenCalled()
    rerender({ sidebar: { collapsed: true, width: 260 } })
    await waitFor(() => expect(sessionWrites().at(-1)).toMatchObject({ sidebar: { collapsed: true, width: 260 } }))
    rerender({ sidebar: { collapsed: true, width: 300 } })
    await waitFor(() => expect(sessionWrites().at(-1)).toMatchObject({ sidebar: { collapsed: true, width: 300 } }))
  })
})
