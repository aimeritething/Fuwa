import { describe, expect, it, vi } from 'vitest'
import type { VaultEntry } from '../types'
import { refreshNoteWindowVaultChanges } from './noteWindowVaultRefresh'

function makeEntry(path: string, title: string): VaultEntry {
  return {
    path,
    title,
    filename: path.split('/').pop() ?? 'note.md',
    snippet: '',
    wordCount: 0,
    outgoingLinks: [],
  } as VaultEntry
}

describe('refreshNoteWindowVaultChanges', () => {
  it('updates a changed sibling entry without reloading the graph or remounting the active editor', async () => {
    const activeEntry = makeEntry('/vault/active.md', 'Active')
    const changedEntry = makeEntry('/vault/other.md', 'Other updated')
    const applyEntry = vi.fn()
    const closeAllTabs = vi.fn()
    const refreshFullVault = vi.fn().mockResolvedValue([])
    const replaceActiveTab = vi.fn().mockResolvedValue(undefined)

    const entries = await refreshNoteWindowVaultChanges({
      activeTabPath: activeEntry.path,
      applyEntry,
      closeAllTabs,
      currentEntries: [activeEntry, makeEntry(changedEntry.path, 'Other')],
      getActiveTabPath: () => activeEntry.path,
      hasUnsavedChanges: () => false,
      isActiveTabContentCurrent: vi.fn().mockResolvedValue(false),
      paths: [changedEntry.path],
      refreshFullVault,
      reloadEntry: vi.fn().mockResolvedValue(changedEntry),
      replaceActiveTab,
      vaultPath: '/vault',
    })

    expect(entries).toEqual([activeEntry, changedEntry])
    expect(applyEntry).toHaveBeenCalledWith(changedEntry)
    expect(refreshFullVault).not.toHaveBeenCalled()
    expect(closeAllTabs).not.toHaveBeenCalled()
    expect(replaceActiveTab).not.toHaveBeenCalled()
  })

  it('falls back to the full reconciler when a changed path cannot be reloaded', async () => {
    const refreshFullVault = vi.fn().mockResolvedValue([makeEntry('/vault/active.md', 'Active')])

    const entries = await refreshNoteWindowVaultChanges({
      activeTabPath: '/vault/active.md',
      applyEntry: vi.fn(),
      closeAllTabs: vi.fn(),
      currentEntries: [makeEntry('/vault/active.md', 'Active')],
      hasUnsavedChanges: () => false,
      paths: ['/vault/deleted.md'],
      refreshFullVault,
      reloadEntry: vi.fn().mockRejectedValue(new Error('missing')),
      replaceActiveTab: vi.fn().mockResolvedValue(undefined),
      vaultPath: '/vault',
    })

    expect(refreshFullVault).toHaveBeenCalledWith(['/vault/deleted.md'])
    expect(entries).toEqual([makeEntry('/vault/active.md', 'Active')])
  })
})
