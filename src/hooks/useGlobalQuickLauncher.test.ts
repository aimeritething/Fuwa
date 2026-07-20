import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetQuickLauncherShortcutStateForTests } from '../lib/quickLauncherShortcut'
import {
  resetQuickLauncherShortcutStatusForTests,
  useGlobalQuickLauncher,
  useQuickLauncherShortcutStatus,
} from './useGlobalQuickLauncher'

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  register: vi.fn(),
  unregister: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-global-shortcut', () => ({
  register: mocks.register,
  unregister: mocks.unregister,
}))

vi.mock('../mock-tauri', () => ({ isTauri: () => true }))
vi.mock('../utils/openQuickLauncherWindow', () => ({ openQuickLauncherWindow: mocks.open }))

describe('useGlobalQuickLauncher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetQuickLauncherShortcutStateForTests()
    resetQuickLauncherShortcutStatusForTests()
    mocks.register.mockResolvedValue(undefined)
    mocks.unregister.mockResolvedValue(undefined)
  })

  it('registers the default shortcut and opens only on key press', async () => {
    renderHook(() => useGlobalQuickLauncher())
    await waitFor(() => expect(mocks.register).toHaveBeenCalledOnce())

    const handler = mocks.register.mock.calls[0]?.[1]
    act(() => handler({ state: 'Released' }))
    expect(mocks.open).not.toHaveBeenCalled()
    act(() => handler({ state: 'Pressed' }))
    expect(mocks.open).toHaveBeenCalledOnce()
  })

  it('publishes conflicts while preserving the previous shortcut', async () => {
    const { rerender } = renderHook(
      ({ shortcut }) => {
        useGlobalQuickLauncher(shortcut)
        return useQuickLauncherShortcutStatus()
      },
      { initialProps: { shortcut: 'CommandOrControl+Alt+T' } },
    )
    await waitFor(() => expect(mocks.register).toHaveBeenCalledOnce())
    mocks.register.mockRejectedValueOnce(new Error('Shortcut already in use'))
    rerender({ shortcut: 'CommandOrControl+Shift+K' })

    await waitFor(() => expect(mocks.register).toHaveBeenCalledTimes(3))
    const { result } = renderHook(() => useQuickLauncherShortcutStatus())
    expect(result.current).toEqual({
      activeShortcut: 'CommandOrControl+Alt+T',
      message: 'Shortcut already in use',
      state: 'error',
    })
  })
})
