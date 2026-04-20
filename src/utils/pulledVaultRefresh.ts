import type { VaultEntry } from '../types'

interface PulledVaultRefreshOptions {
  activeTabPath: string | null
  closeAllTabs: () => void
  hasUnsavedChanges: (path: string) => boolean
  reloadFolders: () => Promise<unknown> | unknown
  reloadVault: () => Promise<VaultEntry[]>
  reloadViews: () => Promise<unknown> | unknown
  replaceActiveTab: (entry: VaultEntry) => Promise<void>
  updatedFiles: string[]
  vaultPath: string
}

function normalizePath(path: string): string {
  return path
    .replaceAll('\\', '/')
    .replace(/^\/private\/tmp(?=\/|$)/u, '/tmp')
    .replace(/\/+$/u, '')
}

export async function refreshPulledVaultState(options: PulledVaultRefreshOptions): Promise<VaultEntry[]> {
  const {
    activeTabPath,
    closeAllTabs,
    hasUnsavedChanges,
    reloadFolders,
    reloadVault,
    reloadViews,
    replaceActiveTab,
  } = options

  const [entries] = await Promise.all([
    reloadVault(),
    Promise.resolve(reloadFolders()),
    Promise.resolve(reloadViews()),
  ])

  if (!activeTabPath || hasUnsavedChanges(activeTabPath)) return entries

  const refreshedEntry = entries.find(entry => normalizePath(entry.path) === normalizePath(activeTabPath))
  if (!refreshedEntry) {
    closeAllTabs()
    return entries
  }

  await replaceActiveTab(refreshedEntry)
  return entries
}
