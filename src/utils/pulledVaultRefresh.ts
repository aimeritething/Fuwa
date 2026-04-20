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

function resolveUpdatedFilePath(path: string, vaultPath: string): string {
  if (path.startsWith('/')) return normalizePath(path)
  return normalizePath(`${vaultPath}/${path}`)
}

function didPullUpdateActiveNote(updatedFiles: string[], vaultPath: string, activeTabPath: string): boolean {
  const normalizedActivePath = normalizePath(activeTabPath)
  return updatedFiles.some((path) => resolveUpdatedFilePath(path, vaultPath) === normalizedActivePath)
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
    updatedFiles,
    vaultPath,
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

  // Native BlockNote can keep rendering the previous document after a pull that
  // changes the active file in place. Dropping the tab first forces a full
  // reopen for that specific case without affecting unrelated pull updates.
  if (didPullUpdateActiveNote(updatedFiles, vaultPath, activeTabPath)) {
    closeAllTabs()
  }

  await replaceActiveTab(refreshedEntry)
  return entries
}
