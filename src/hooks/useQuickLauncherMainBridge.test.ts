import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QUICK_LAUNCHER_OPEN_NOTE_EVENT } from '../lib/quickLauncherEvents'
import { useQuickLauncherMainBridge } from './useQuickLauncherMainBridge'

const mocks = vi.hoisted(() => ({
  focus: vi.fn(),
  listen: vi.fn(),
  show: vi.fn(),
  unlisten: vi.fn(),
  unminimize: vi.fn(),
}))

vi.mock('@tauri-apps/api/event', () => ({ listen: mocks.listen }))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ setFocus: mocks.focus, show: mocks.show, unminimize: mocks.unminimize }),
}))
vi.mock('../mock-tauri', () => ({ isTauri: () => true }))

describe('useQuickLauncherMainBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listen.mockResolvedValue(mocks.unlisten)
    mocks.unminimize.mockResolvedValue(undefined)
    mocks.show.mockResolvedValue(undefined)
    mocks.focus.mockResolvedValue(undefined)
  })

  it('forwards only safe Tolaria note URLs and removes its listener', async () => {
    const openDeepLink = vi.fn()
    const { unmount } = renderHook(() => useQuickLauncherMainBridge(openDeepLink))
    await waitFor(() => expect(mocks.listen).toHaveBeenCalledWith(
      QUICK_LAUNCHER_OPEN_NOTE_EVENT,
      expect.any(Function),
    ))
    const listener = mocks.listen.mock.calls[0]?.[1]

    listener({ payload: { url: 'https://example.com/not-a-note' } })
    listener({ payload: { url: 'tolaria://work/note.md' } })
    await waitFor(() => expect(openDeepLink).toHaveBeenCalledWith('tolaria://work/note.md'))
    expect(mocks.show).toHaveBeenCalledOnce()
    expect(mocks.focus).toHaveBeenCalledOnce()

    unmount()
    await waitFor(() => expect(mocks.unlisten).toHaveBeenCalledOnce())
  })

  it('opens the note even when restoring main-window focus fails', async () => {
    const openDeepLink = vi.fn()
    mocks.unminimize.mockRejectedValueOnce(new Error('window state unavailable'))
    renderHook(() => useQuickLauncherMainBridge(openDeepLink))
    await waitFor(() => expect(mocks.listen).toHaveBeenCalled())

    const listener = mocks.listen.mock.calls[0]?.[1]
    listener({ payload: { url: 'tolaria://work/note.md' } })

    await waitFor(() => expect(openDeepLink).toHaveBeenCalledWith('tolaria://work/note.md'))
  })
})
