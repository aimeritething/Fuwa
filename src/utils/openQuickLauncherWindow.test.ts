import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildQuickLauncherWindowUrl,
  openQuickLauncherWindow,
  QUICK_LAUNCHER_WINDOW_LABEL,
} from './openQuickLauncherWindow'
import { isTauri } from '../mock-tauri'

const webviewWindowCalls = vi.fn()
const getByLabel = vi.fn()
const show = vi.fn().mockResolvedValue(undefined)
const unminimize = vi.fn().mockResolvedValue(undefined)
const setFocus = vi.fn().mockResolvedValue(undefined)

vi.mock('../mock-tauri', () => ({ isTauri: vi.fn() }))
vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: class MockWebviewWindow {
    static getByLabel = getByLabel

    constructor(label: string, options: unknown) {
      webviewWindowCalls(label, options)
    }
  },
}))

describe('openQuickLauncherWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isTauri).mockReturnValue(false)
    getByLabel.mockResolvedValue(null)
  })

  it('builds the dedicated launcher route', () => {
    const url = new URL(buildQuickLauncherWindowUrl(), 'https://tolaria.localhost')
    expect(url.pathname).toBe('/')
    expect(url.searchParams.get('window')).toBe('quick-launcher')
  })

  it('creates one compact centered always-on-top launcher', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    await openQuickLauncherWindow()

    expect(webviewWindowCalls).toHaveBeenCalledWith(
      QUICK_LAUNCHER_WINDOW_LABEL,
      expect.objectContaining({
        alwaysOnTop: true,
        backgroundColor: '#00000000',
        center: true,
        decorations: false,
        focus: true,
        height: 420,
        minimizable: false,
        resizable: false,
        shadow: false,
        skipTaskbar: true,
        title: 'Tolaria Quick Launcher',
        transparent: true,
        visible: true,
        width: 540,
      }),
    )
  })

  it('focuses the existing singleton instead of creating another window', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    getByLabel.mockResolvedValue({ show, unminimize, setFocus })

    await openQuickLauncherWindow()

    expect(unminimize).toHaveBeenCalledOnce()
    expect(show).toHaveBeenCalledOnce()
    expect(setFocus).toHaveBeenCalledOnce()
    expect(webviewWindowCalls).not.toHaveBeenCalled()
  })
})
