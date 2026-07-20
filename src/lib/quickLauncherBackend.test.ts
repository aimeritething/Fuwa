import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VaultOption } from '../components/StatusBar'
import { createQuickCapture, loadQuickLauncherEntries, searchQuickLauncherVaults } from './quickLauncherBackend'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: mocks.invoke,
}))

const vaults: VaultOption[] = [
  { available: true, label: 'Work', mounted: true, path: '/work', searchEnabled: true },
  { available: true, label: 'Private', mounted: true, path: '/private', searchEnabled: false },
  { available: false, label: 'Offline', mounted: true, path: '/offline', searchEnabled: true },
]

describe('quickLauncherBackend', () => {
  beforeEach(() => vi.clearAllMocks())

  it('searches only available opted-in vaults and preserves vault identity', async () => {
    mocks.invoke.mockResolvedValue({
      results: [{
        match_category: 'path',
        path: '/work/projects/needle.md',
        relative_path: 'projects/needle.md',
        score: 20,
        snippet: '',
        title: 'Project',
      }],
    })

    const response = await searchQuickLauncherVaults({ query: 'needle', scopePath: null, vaults })

    expect(mocks.invoke).toHaveBeenCalledOnce()
    expect(mocks.invoke).toHaveBeenCalledWith('search_vault', expect.objectContaining({ vaultPath: '/work' }))
    expect(response.results[0]).toEqual(expect.objectContaining({
      relativePath: 'projects/needle.md',
      vaultLabel: 'Work',
    }))
    expect(response.failedVaultLabels).toEqual([])
  })

  it('creates a collision-safe note without overwriting the existing file', async () => {
    mocks.invoke.mockImplementation((command: string) => {
      if (command === 'list_vault') return Promise.resolve([
        { path: '/work/inbox/meeting.md' },
        { path: '/work/inbox/meeting-2.md' },
      ])
      return Promise.resolve(undefined)
    })

    const result = await createQuickCapture({
      body: 'Decisions',
      folder: 'inbox',
      title: 'Meeting',
      vaultPath: '/work',
    })

    expect(result.relativePath).toBe('inbox/meeting-3.md')
    expect(result.collided).toBe(true)
    expect(mocks.invoke).toHaveBeenLastCalledWith('create_note_content', {
      content: '# Meeting\n\nDecisions\n',
      path: '/work/inbox/meeting-3.md',
      vaultPath: '/work',
    })
  })

  it('loads searchable vault entries with workspace presentation metadata', async () => {
    mocks.invoke.mockResolvedValue([{ path: '/work/project.md', title: 'Project' }])

    const entries = await loadQuickLauncherEntries(vaults)

    expect(mocks.invoke).toHaveBeenCalledOnce()
    expect(entries).toEqual([expect.objectContaining({
      path: '/work/project.md',
      workspace: expect.objectContaining({ label: 'Work', path: '/work' }),
    })])
  })
})
