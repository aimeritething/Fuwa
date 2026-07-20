import { describe, expect, it } from 'vitest'

import {
  quickLauncherResultId,
  rankQuickLauncherResults,
  resolveQuickCaptureDestination,
  uniqueCaptureRelativePath,
  type QuickCaptureVault,
  type QuickLauncherSearchResult,
} from './quickLauncher'

const vaults: QuickCaptureVault[] = [
  { id: 'work', label: 'Work', path: '/vaults/work', available: true, writable: true },
  { id: 'home', label: 'Home', path: '/vaults/home', available: true, writable: true },
]

describe('quick capture destination resolution', () => {
  it('uses configured, active, then last-successful destinations in order', () => {
    const configured = { vaultPath: '/vaults/home', folder: 'Inbox' }
    const active = { vaultPath: '/vaults/work', folder: 'Quick Notes' }
    const last = { vaultPath: '/vaults/work', folder: 'Archive' }

    expect(resolveQuickCaptureDestination({ configured, active, last, vaults })).toEqual({
      destination: configured,
      source: 'configured',
      requiresAttention: false,
    })
    expect(resolveQuickCaptureDestination({ configured: null, active, last, vaults }).source).toBe('active')
    expect(resolveQuickCaptureDestination({ configured: null, active: null, last, vaults }).source).toBe('last')
  })

  it('requires attention instead of silently replacing an unavailable configured destination', () => {
    expect(resolveQuickCaptureDestination({
      configured: { vaultPath: '/vaults/missing', folder: 'Inbox' },
      active: { vaultPath: '/vaults/work', folder: '' },
      last: null,
      vaults,
    })).toEqual({ destination: null, source: 'configured', requiresAttention: true })
  })

  it('rejects unavailable and read-only vaults', () => {
    const restrictedVaults: QuickCaptureVault[] = [
      { id: 'offline', label: 'Offline', path: '/offline', available: false, writable: true },
      { id: 'readonly', label: 'Readonly', path: '/readonly', available: true, writable: false },
    ]
    expect(resolveQuickCaptureDestination({
      configured: null,
      active: { vaultPath: '/offline', folder: '' },
      last: { vaultPath: '/readonly', folder: '' },
      vaults: restrictedVaults,
    })).toEqual({ destination: null, source: 'none', requiresAttention: true })
  })
})

describe('quick launcher result identity and ranking', () => {
  const result = (overrides: Partial<QuickLauncherSearchResult>): QuickLauncherSearchResult => ({
    title: 'Alpha',
    absolutePath: '/vaults/work/alpha.md',
    relativePath: 'alpha.md',
    snippet: '',
    vaultId: 'work',
    vaultLabel: 'Work',
    vaultPath: '/vaults/work',
    matchCategory: 'body',
    score: 1,
    ...overrides,
  })

  it('keeps duplicate note titles distinct by vault ID and relative path', () => {
    expect(quickLauncherResultId(result({}))).toBe('work\nalpha.md')
    expect(quickLauncherResultId(result({ vaultId: 'home' }))).toBe('home\nalpha.md')
  })

  it('ranks exact titles before paths and body-only matches', () => {
    const ranked = rankQuickLauncherResults([
      result({ title: 'Body', matchCategory: 'body', score: 20 }),
      result({ title: 'Path', matchCategory: 'path', score: 5 }),
      result({ title: 'Exact', matchCategory: 'exact_title', score: 1 }),
      result({ title: 'Title', matchCategory: 'title', score: 10 }),
    ])
    expect(ranked.map((item) => item.title)).toEqual(['Exact', 'Title', 'Path', 'Body'])
  })
})

describe('quick capture filename collisions', () => {
  it('uses normal slug safety and preserves both notes with a previewed suffix', () => {
    expect(uniqueCaptureRelativePath({
      title: 'Quarterly / Review',
      folder: 'Quick Notes',
      existingRelativePaths: ['Quick Notes/quarterly-review.md', 'Quick Notes/quarterly-review-2.md'],
    })).toEqual({ relativePath: 'Quick Notes/quarterly-review-3.md', collided: true })
  })
})
