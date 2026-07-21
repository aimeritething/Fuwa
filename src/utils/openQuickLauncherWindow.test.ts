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
  })

  it('delegates launcher creation and native chrome setup to Tauri', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    await openQuickLauncherWindow()

    expect(invoke).toHaveBeenCalledWith('show_quick_launcher')
  })

  it('does nothing outside Tauri', async () => {
    await openQuickLauncherWindow()

    expect(invoke).not.toHaveBeenCalled()
  })
})
