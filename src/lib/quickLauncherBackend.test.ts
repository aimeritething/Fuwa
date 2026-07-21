import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VaultOption } from '../components/StatusBar'
import { createQuickCapture, searchQuickLauncherVaults } from './quickLauncherBackend'

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), nativeInvoke: vi.fn(), tauri: false }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.nativeInvoke }))
vi.mock('../mock-tauri', () => ({
  isTauri: () => mocks.tauri,
  mockInvoke: mocks.invoke,
}))

const vaults: VaultOption[] = [
  { available: true, label: 'Work', mounted: true, path: '/work', searchEnabled: true },
  { available: true, label: 'Private', mounted: true, path: '/private', searchEnabled: false },
  { available: false, label: 'Offline', mounted: true, path: '/offline', searchEnabled: true },
]

describe('quickLauncherBackend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.tauri = false
  })

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

  it('uses the atomic native command for root-level launcher notes', async () => {
    mocks.tauri = true
    mocks.nativeInvoke.mockResolvedValue({
      absolutePath: '/work/team-sync.md',
      collided: false,
      relativePath: 'team-sync.md',
    })

    const result = await createQuickCapture({
      body: '',
      folder: '',
      title: 'Team Sync',
      vaultPath: '/work',
    })

    expect(result.relativePath).toBe('team-sync.md')
    expect(mocks.nativeInvoke).toHaveBeenCalledOnce()
    expect(mocks.nativeInvoke).toHaveBeenCalledWith('create_quick_launcher_note', {
      title: 'Team Sync',
      vaultPath: '/work',
    })
  })

})
