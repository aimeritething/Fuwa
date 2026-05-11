import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { FolderNode, GitPushResult, VaultEntry, ViewFile } from '../types'
import type { VaultOption } from '../components/status-bar/types'
import { normalizeVaultEntries, normalizeViewFiles } from '../utils/vaultMetadataNormalization'
import { workspaceIdentityFromVault } from '../utils/workspaces'

interface TauriCallOptions {
  command: string
  tauriArgs: Record<string, unknown>
  mockArgs?: Record<string, unknown>
}

interface VaultPathOptions {
  vaultPath: string
}

interface MountedVaultEntriesOptions extends VaultPathOptions {
  defaultWorkspacePath?: string | null
  forceReload?: boolean
  includeFallbackVault?: boolean
  vaults?: VaultOption[]
}

type MountedVaultFoldersOptions = MountedVaultEntriesOptions

interface CommitWithPushOptions extends VaultPathOptions {
  message: string
}

interface LoadedVaultData {
  entries: VaultEntry[]
}

interface LoadedVaultChrome {
  folders: FolderNode[]
  views: ViewFile[]
}

export function hasVaultPath({ vaultPath }: VaultPathOptions): boolean {
  return vaultPath.trim().length > 0
}

export function tauriCall<T>({ command, tauriArgs, mockArgs }: TauriCallOptions): Promise<T> {
  return isTauri() ? invoke<T>(command, tauriArgs) : mockInvoke<T>(command, mockArgs ?? tauriArgs)
}

export async function checkVaultPathAvailability({ vaultPath }: VaultPathOptions): Promise<boolean | null> {
  if (!hasVaultPath({ vaultPath })) return false

  try {
    return await tauriCall<boolean>({
      command: 'check_vault_exists',
      tauriArgs: { path: vaultPath },
    })
  } catch {
    return null
  }
}

function loadVaultEntriesWithCommand({ vaultPath, command }: VaultPathOptions & { command: string }): Promise<VaultEntry[]> {
  return tauriCall<unknown>({ command, tauriArgs: { path: vaultPath } })
    .then((entries) => normalizeVaultEntries(entries, vaultPath))
}

export function loadWorkspaceEntries(
  vault: VaultOption,
  defaultWorkspacePath?: string | null,
  options: { forceReload?: boolean } = {},
): Promise<VaultEntry[]> {
  const workspace = workspaceIdentityFromVault(vault, { defaultWorkspacePath })
  const command = options.forceReload && isTauri() ? 'reload_vault' : 'list_vault'
  return tauriCall<unknown>({ command, tauriArgs: { path: vault.path } })
    .then((entries) => normalizeVaultEntries(entries, vault.path, workspace))
}

function uniqueMountedVaults({ vaultPath, vaults = [], includeFallbackVault = true }: MountedVaultEntriesOptions): VaultOption[] {
  const byPath = new Map<string, VaultOption>()
  for (const vault of vaults) {
    if (vault.available === false || vault.mounted === false || !vault.path.trim()) continue
    byPath.set(vault.path, vault)
  }
  if (includeFallbackVault && vaultPath.trim() && !byPath.has(vaultPath)) {
    byPath.set(vaultPath, { label: vaultPath.split('/').filter(Boolean).pop() || 'Workspace', path: vaultPath, mounted: true, available: true })
  }
  return [...byPath.values()]
}

function loadMountedVaultEntries(options: MountedVaultEntriesOptions): Promise<VaultEntry[]> {
  const mountedVaults = uniqueMountedVaults(options)
  if (mountedVaults.length <= 1) {
    const onlyVault = mountedVaults[0]
    return onlyVault
      ? loadWorkspaceEntries(onlyVault, options.defaultWorkspacePath, { forceReload: options.forceReload })
      : loadVaultEntries({ vaultPath: options.vaultPath })
  }
  return Promise.all(mountedVaults.map((vault) => (
    loadWorkspaceEntries(vault, options.defaultWorkspacePath, { forceReload: options.forceReload })
  )))
    .then((groups) => groups.flat())
}

function attachFolderRootPath(folders: FolderNode[], rootPath: string): FolderNode[] {
  return folders.map((folder) => ({
    ...folder,
    rootPath,
    children: attachFolderRootPath(folder.children, rootPath),
  }))
}

function loadVaultEntries({ vaultPath }: VaultPathOptions): Promise<VaultEntry[]> {
  const command = isTauri() ? 'reload_vault' : 'list_vault'
  return loadVaultEntriesWithCommand({ vaultPath, command })
}

export function reloadVaultEntries({ vaultPath, vaults, defaultWorkspacePath }: MountedVaultEntriesOptions): Promise<VaultEntry[]> {
  if (vaults?.length) return loadMountedVaultEntries({ vaultPath, vaults, defaultWorkspacePath, forceReload: true })
  return loadVaultEntriesWithCommand({ vaultPath, command: 'reload_vault' })
}

export function loadVaultFolders({ vaultPath }: VaultPathOptions): Promise<FolderNode[]> {
  return tauriCall<FolderNode[]>({ command: 'list_vault_folders', tauriArgs: { path: vaultPath } })
}

export async function loadMountedVaultFolders(options: MountedVaultFoldersOptions): Promise<FolderNode[]> {
  const mountedVaults = uniqueMountedVaults({ ...options, includeFallbackVault: false })
  if (mountedVaults.length === 0) return []
  if (mountedVaults.length === 1) {
    const [vault] = mountedVaults
    if (vault.path === options.vaultPath) return loadVaultFolders({ vaultPath: vault.path })

    const identity = workspaceIdentityFromVault(vault, { defaultWorkspacePath: options.defaultWorkspacePath })
    const children = await loadVaultFolders({ vaultPath: vault.path })
      .then((folders) => attachFolderRootPath(folders ?? [], vault.path))
      .catch(() => [] as FolderNode[])
    return [{
      name: identity.label,
      path: '',
      rootPath: vault.path,
      children,
    }]
  }

  const folderGroups = await Promise.all(mountedVaults.map(async (vault) => {
    const identity = workspaceIdentityFromVault(vault, { defaultWorkspacePath: options.defaultWorkspacePath })
    const children = await loadVaultFolders({ vaultPath: vault.path })
      .then((folders) => attachFolderRootPath(folders ?? [], vault.path))
      .catch(() => [] as FolderNode[])
    return {
      name: identity.label,
      path: '',
      rootPath: vault.path,
      children,
    }
  }))

  return folderGroups
}

export function loadVaultViews({ vaultPath }: VaultPathOptions): Promise<ViewFile[]> {
  return tauriCall<unknown>({ command: 'list_views', tauriArgs: { vaultPath } })
    .then(normalizeViewFiles)
}

export async function loadVaultData({ vaultPath, vaults, defaultWorkspacePath }: MountedVaultEntriesOptions): Promise<LoadedVaultData> {
  if (!isTauri()) console.info('[mock] Using mock Tauri data for browser testing')
  const entries = vaults?.length
    ? await loadMountedVaultEntries({ vaultPath, vaults, defaultWorkspacePath })
    : await loadVaultEntries({ vaultPath })
  console.log(`Vault scan complete: ${entries.length} entries found`)
  return { entries }
}

export async function loadVaultChrome({ vaultPath }: VaultPathOptions): Promise<LoadedVaultChrome> {
  const [folders, views] = await Promise.all([
    loadVaultFolders({ vaultPath }).catch(() => [] as FolderNode[]),
    loadVaultViews({ vaultPath }).catch(() => [] as ViewFile[]),
  ])

  return {
    folders: folders ?? [],
    views: views ?? [],
  }
}

export async function commitWithPush({ vaultPath, message }: CommitWithPushOptions): Promise<GitPushResult> {
  if (!isTauri()) {
    await mockInvoke<string>('git_commit', { message })
    return mockInvoke<GitPushResult>('git_push', {})
  }
  await invoke<string>('git_commit', { vaultPath, message })
  return invoke<GitPushResult>('git_push', { vaultPath })
}
