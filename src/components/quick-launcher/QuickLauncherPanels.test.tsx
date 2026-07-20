import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTranslator } from '../../lib/i18n'
import type { Settings } from '../../types'
import { QuickCapturePanel } from './QuickCapturePanel'
import { QuickLauncherSearchPanel } from './QuickLauncherSearchPanel'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  folders: vi.fn(),
  hide: vi.fn(),
  openNote: vi.fn(),
  preview: vi.fn(),
  search: vi.fn(),
}))

vi.mock('../../lib/quickLauncherBackend', () => ({
  createQuickCapture: mocks.create,
  loadQuickCaptureFolders: mocks.folders,
  previewQuickCapture: mocks.preview,
  searchQuickLauncherVaults: mocks.search,
}))
vi.mock('../../utils/openQuickLauncherNote', () => ({ openQuickLauncherNote: mocks.openNote }))
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ hide: mocks.hide }) }))

const t = createTranslator('en')
const vaults = [{ available: true, label: 'Work', mounted: true, path: '/work', searchEnabled: true }]
const settings = {
  auto_pull_interval_minutes: null,
  telemetry_consent: null,
  crash_reporting_enabled: null,
  analytics_enabled: null,
  anonymous_id: null,
  release_channel: null,
  quick_capture_open_after_save: false,
} satisfies Settings

describe('Quick Launcher panels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.folders.mockResolvedValue([])
    mocks.preview.mockResolvedValue({
      absolutePath: '/work/meeting.md',
      collided: false,
      collidingAbsolutePath: null,
      relativePath: 'meeting.md',
    })
    mocks.openNote.mockResolvedValue(undefined)
    mocks.hide.mockResolvedValue(undefined)
  })

  it('searches across registered vaults and opens the selected exact identity', async () => {
    mocks.search.mockResolvedValue({
      failedVaultLabels: [],
      results: [{
        absolutePath: '/work/meeting.md',
        matchCategory: 'title',
        relativePath: 'meeting.md',
        score: 30,
        snippet: 'Decisions',
        title: 'Meeting',
        vaultId: 'work',
        vaultLabel: 'Work',
        vaultPath: '/work',
      }],
    })
    render(<QuickLauncherSearchPanel t={t} vaults={vaults} />)

    fireEvent.change(screen.getByLabelText('Search every vault…'), { target: { value: 'meeting' } })
    expect(await screen.findByText('Meeting')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Meeting'))

    await waitFor(() => expect(mocks.openNote).toHaveBeenCalledWith(expect.objectContaining({
      absolutePath: '/work/meeting.md',
      vaultPath: '/work',
    })))
  })

  it('saves capture content with the keyboard shortcut and concrete destination', async () => {
    mocks.create.mockResolvedValue({ absolutePath: '/work/meeting.md', collided: false, relativePath: 'meeting.md' })
    render(<QuickCapturePanel initialDestination={{ folder: '', vaultPath: '/work' }} settings={settings} t={t} vaults={vaults} />)

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Meeting' } })
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Decisions' } })
    fireEvent.keyDown(screen.getByLabelText('Body'), { key: 'Enter', metaKey: true })

    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({
      body: 'Decisions',
      folder: '',
      title: 'Meeting',
      vaultPath: '/work',
    }))
    expect(await screen.findByText('Capture saved')).toBeInTheDocument()
  })
})
