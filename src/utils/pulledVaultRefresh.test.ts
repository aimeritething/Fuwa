import { describe, expect, it, vi } from 'vitest'
import type { VaultEntry } from '../types'
import { refreshPulledVaultState } from './pulledVaultRefresh'

function makeEntry(path: string, title = 'Test note'): VaultEntry {
  return {
    path,
    title,
    filename: path.split('/').pop() ?? 'note.md',
    snippet: '',
    wordCount: 0,
    outgoingLinks: [],
  } as VaultEntry
}

function makeOptions(overrides: Partial<Parameters<typeof refreshPulledVaultState>[0]> = {}) {
  const activeEntry = makeEntry('/vault/active.md', 'Active')
  return {
    activeTabPath: activeEntry.path,
    closeAllTabs: vi.fn(),
    hasUnsavedChanges: vi.fn(() => false),
    reloadFolders: vi.fn(),
    reloadVault: vi.fn().mockResolvedValue([activeEntry]),
    reloadViews: vi.fn(),
    replaceActiveTab: vi.fn().mockResolvedValue(undefined),
    updatedFiles: ['active.md'],
    vaultPath: '/vault',
    ...overrides,
  }
}

describe('refreshPulledVaultState', () => {
  it('reloads vault-derived data and refreshes the active note when pull updated it', async () => {
    const options = makeOptions()

    const entries = await refreshPulledVaultState(options)

    expect(entries).toHaveLength(1)
    expect(options.reloadVault).toHaveBeenCalledOnce()
    expect(options.reloadFolders).toHaveBeenCalledOnce()
    expect(options.reloadViews).toHaveBeenCalledOnce()
    expect(options.replaceActiveTab).toHaveBeenCalledWith(entries[0])
    expect(options.closeAllTabs).not.toHaveBeenCalled()
  })

  it('reloads the active tab after any successful pull with updates', async () => {
    const options = makeOptions({ updatedFiles: ['project/plan.md'] })

    await refreshPulledVaultState(options)

    expect(options.reloadVault).toHaveBeenCalledOnce()
    expect(options.replaceActiveTab).toHaveBeenCalledWith(expect.objectContaining({ path: '/vault/active.md' }))
    expect(options.closeAllTabs).not.toHaveBeenCalled()
  })

  it('matches macOS /tmp and /private/tmp aliases when reloading the active tab entry', async () => {
    const activeEntry = makeEntry('/private/tmp/tolaria/active.md', 'Active')
    const options = makeOptions({
      activeTabPath: activeEntry.path,
      reloadVault: vi.fn().mockResolvedValue([activeEntry]),
      vaultPath: '/tmp/tolaria',
    })

    await refreshPulledVaultState(options)

    expect(options.replaceActiveTab).toHaveBeenCalledWith(activeEntry)
  })

  it('skips tab replacement when the active note has unsaved edits', async () => {
    const options = makeOptions({
      hasUnsavedChanges: vi.fn((path: string) => path === '/vault/active.md'),
    })

    await refreshPulledVaultState(options)

    expect(options.replaceActiveTab).not.toHaveBeenCalled()
    expect(options.closeAllTabs).not.toHaveBeenCalled()
  })

  it('closes the tab when the pulled note disappeared from the reloaded vault', async () => {
    const options = makeOptions({
      reloadVault: vi.fn().mockResolvedValue([makeEntry('/vault/other.md', 'Other')]),
    })

    await refreshPulledVaultState(options)

    expect(options.replaceActiveTab).not.toHaveBeenCalled()
    expect(options.closeAllTabs).toHaveBeenCalledOnce()
  })
})
