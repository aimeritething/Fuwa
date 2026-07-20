import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QuickLauncherWindowApp } from './QuickLauncherWindowApp'

const mocks = vi.hoisted(() => ({
  hide: vi.fn(),
  onFocusChanged: vi.fn(),
  unlisten: vi.fn(),
}))

vi.mock('../mock-tauri', () => ({ isTauri: () => true }))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ onFocusChanged: mocks.onFocusChanged }),
}))
vi.mock('../utils/openQuickLauncherWindow', () => ({ hideQuickLauncherWindow: mocks.hide }))
vi.mock('./quick-launcher/useQuickLauncherContext', () => ({
  useQuickLauncherContext: () => ({
    destinationResolution: { destination: { folder: '', vaultPath: '/work' } },
    loaded: true,
    locale: 'en',
    settings: { quick_capture_open_after_save: false },
    vaults: [{ available: true, label: 'Work', mounted: true, path: '/work' }],
  }),
}))
vi.mock('./quick-launcher/QuickLauncherSearchPanel', () => ({
  QuickLauncherSearchPanel: () => <input aria-label="Unified launcher input" />,
}))

describe('QuickLauncherWindowApp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.hide.mockResolvedValue(undefined)
    mocks.onFocusChanged.mockResolvedValue(mocks.unlisten)
  })

  it('uses one launcher surface and closes on Escape', () => {
    render(<QuickLauncherWindowApp />)

    expect(screen.getByLabelText('Unified launcher input')).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(mocks.hide).toHaveBeenCalledOnce()
  })

  it('closes when the native launcher window loses focus', async () => {
    render(<QuickLauncherWindowApp />)
    await waitFor(() => expect(mocks.onFocusChanged).toHaveBeenCalledOnce())

    const handleFocusChanged = mocks.onFocusChanged.mock.calls[0]?.[0]
    act(() => handleFocusChanged({ payload: false }))

    expect(mocks.hide).toHaveBeenCalledOnce()
  })
})
