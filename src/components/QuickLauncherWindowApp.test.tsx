import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QuickLauncherWindowApp } from './QuickLauncherWindowApp'

const mocks = vi.hoisted(() => ({
  hide: vi.fn(),
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
  })

  it('uses one launcher surface and closes on Escape', () => {
    render(<QuickLauncherWindowApp />)

    expect(screen.getByLabelText('Unified launcher input')).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(mocks.hide).toHaveBeenCalledOnce()
  })
})
