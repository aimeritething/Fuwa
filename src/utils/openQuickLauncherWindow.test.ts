import { beforeEach, describe, expect, it, vi } from 'vitest'

import { openQuickLauncherWindow } from './openQuickLauncherWindow'
import { isTauri } from '../mock-tauri'

const invoke = vi.fn().mockResolvedValue(undefined)

vi.mock('../mock-tauri', () => ({ isTauri: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke }))

describe('openQuickLauncherWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isTauri).mockReturnValue(false)
    document.documentElement.lang = 'en'
  })

  it('delegates launcher creation and native chrome setup to Tauri', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    await openQuickLauncherWindow()

    expect(invoke).toHaveBeenCalledWith('show_quick_launcher', {
      copy: {
        clearBackgroundError: 'Failed to clear quick launcher background: {error}',
        createError: 'Failed to create quick launcher: {error}',
        desktopOnlyError: 'The quick launcher is only available on desktop',
        disableShadowError: 'Failed to disable quick launcher native shadow: {error}',
        focusError: 'Failed to focus quick launcher: {error}',
        showError: 'Failed to show quick launcher: {error}',
        title: 'Tolaria Quick Launcher',
        titleError: 'Failed to update quick launcher title: {error}',
        unminimizeError: 'Failed to unminimize quick launcher: {error}',
      },
    })
  })

  it('uses the active document locale for native window copy', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    document.documentElement.lang = 'it-IT'

    await openQuickLauncherWindow()

    expect(invoke.mock.calls[0]?.[1]).toMatchObject({
      copy: {
        title: 'Lanciatore rapido Tolaria',
      },
    })
  })

  it('does nothing outside Tauri', async () => {
    await openQuickLauncherWindow()

    expect(invoke).not.toHaveBeenCalled()
  })
})
