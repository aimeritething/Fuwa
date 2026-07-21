import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTranslator } from '../../lib/i18n'
import type { Settings } from '../../types'
import { QuickLauncherSearchPanel } from './QuickLauncherSearchPanel'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  hide: vi.fn(),
  loadEntries: vi.fn(),
  openNote: vi.fn(),
  search: vi.fn(),
}))

vi.mock('../../lib/quickLauncherBackend', () => ({
  createQuickCapture: mocks.create,
  loadQuickLauncherEntries: mocks.loadEntries,
  searchQuickLauncherVaults: mocks.search,
}))
vi.mock('../../utils/openQuickLauncherNote', () => ({ openQuickLauncherNote: mocks.openNote }))
vi.mock('../../utils/openQuickLauncherWindow', () => ({ hideQuickLauncherWindow: mocks.hide }))

const t = createTranslator('en')
const vaults = [
  { available: true, label: 'Work', mounted: true, path: '/work', searchEnabled: true, shortLabel: 'WK' },
  { available: true, label: 'Research', mounted: true, path: '/research', searchEnabled: true, shortLabel: 'RS' },
]
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
    mocks.openNote.mockResolvedValue(undefined)
    mocks.hide.mockResolvedValue(undefined)
  })

  it('focuses and optically aligns the unified input as soon as it mounts', () => {
    mocks.loadEntries.mockReturnValueOnce(new Promise(() => {}))
    render(<QuickLauncherSearchPanel initialDestination={{ folder: '', vaultPath: '/work' }} settings={settings} t={t} vaults={vaults} />)

    const input = screen.getByLabelText('Search notes or create one…')
    expect(input).toHaveFocus()
    expect(input).toHaveClass('leading-5')
    expect(mocks.loadEntries).not.toHaveBeenCalled()
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
    render(<QuickLauncherSearchPanel initialDestination={{ folder: 'remembered/subfolder', vaultPath: '/work' }} settings={settings} t={t} vaults={vaults} />)

    fireEvent.change(screen.getByLabelText('Search notes or create one…'), { target: { value: 'meeting' } })
    expect(await screen.findByText('Meeting')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create note "meeting"' })).toBeVisible()
    expect(screen.getByTestId('note-search-workspace-badge')).toHaveTextContent('WK')
    fireEvent.mouseDown(screen.getByText('Meeting'))

    await waitFor(() => expect(mocks.openNote).toHaveBeenCalledWith(expect.objectContaining({
      absolutePath: '/work/meeting.md',
      vaultPath: '/work',
    })))
  })

  it('offers an unmatched query as a new note with only a vault destination control', async () => {
    mocks.search.mockResolvedValue({ failedVaultLabels: [], results: [] })
    mocks.create.mockResolvedValue({ absolutePath: '/research/meeting.md', collided: false, relativePath: 'meeting.md' })
    mocks.hide.mockRejectedValueOnce(new Error('native hide denied'))
    render(<QuickLauncherSearchPanel initialDestination={{ folder: 'remembered/subfolder', vaultPath: '/work' }} settings={settings} t={t} vaults={vaults} />)

    const input = screen.getByLabelText('Search notes or create one…')
    fireEvent.change(input, { target: { value: 'Meeting decisions' } })
    expect(await screen.findByText('Create note "Meeting decisions"')).toBeInTheDocument()
    expect(screen.queryByLabelText('Folder')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Body')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Save to vault'))
    fireEvent.click(await screen.findByRole('option', { name: 'Research' }))
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({
      body: '',
      folder: '',
      title: 'Meeting decisions',
      vaultPath: '/research',
    }))
    await waitFor(() => expect(mocks.hide).toHaveBeenCalled())
    expect(screen.queryByText('Could not complete that action. Try again.')).not.toBeInTheDocument()
  })
})
