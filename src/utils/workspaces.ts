import type { VaultEntry, WorkspaceIdentity } from '../types'
import type { VaultOption } from '../components/status-bar/types'

export const WORKSPACE_COLORS = ['blue', 'green', 'purple', 'orange', 'red', 'yellow'] as const
export type WorkspaceColor = typeof WORKSPACE_COLORS[number]

interface WorkspaceIdentityOptions {
  defaultWorkspacePath?: string | null
}

function slugifyWorkspaceAlias(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || 'workspace'
}

export function labelFromWorkspacePath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() || 'Workspace'
}

function shortLabelFromLabel(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'W'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '').join('')
}

export function workspaceAliasFromOption(vault: Pick<VaultOption, 'alias' | 'label' | 'path'>): string {
  return slugifyWorkspaceAlias(vault.alias || vault.label || labelFromWorkspacePath(vault.path))
}

export function workspaceIdentityFromVault(
  vault: VaultOption,
  options: WorkspaceIdentityOptions = {},
): WorkspaceIdentity {
  const label = vault.label.trim() || labelFromWorkspacePath(vault.path)
  const alias = workspaceAliasFromOption({ ...vault, label })
  return {
    id: alias,
    label,
    alias,
    path: vault.path,
    shortLabel: shortLabelFromLabel(label),
    color: vault.color ?? null,
    icon: vault.icon ?? null,
    mounted: vault.mounted !== false,
    available: vault.available !== false,
    defaultForNewNotes: options.defaultWorkspacePath === vault.path,
  }
}

export function workspaceForEntry(entry: Pick<VaultEntry, 'workspace' | 'path'>): WorkspaceIdentity | null {
  return entry.workspace ?? null
}

export function workspacePathForEntry(entry: Pick<VaultEntry, 'workspace'>): string | undefined {
  return entry.workspace?.path
}

export function workspaceLabelForEntry(entry: Pick<VaultEntry, 'workspace'>): string | null {
  return entry.workspace?.label ?? null
}

export function workspaceDisplayPrefix(entry: Pick<VaultEntry, 'workspace'>): string | null {
  const workspace = entry.workspace ?? null
  return workspace ? `${workspace.label} / ` : null
}

export function mountedWorkspacePaths(vaults: VaultOption[]): string[] {
  return vaults
    .filter((vault) => vault.available !== false && vault.mounted !== false)
    .map((vault) => vault.path)
}

export function workspacesMountedInGraph<T extends { path: string; available?: boolean; mounted?: boolean; managedDefault?: boolean }>(
  vaults: T[],
  activeVaultPath: string,
): T[] {
  return vaults.filter((vault) => {
    if (vault.path === activeVaultPath) return true
    return vault.available !== false && vault.mounted !== false && vault.managedDefault !== true
  })
}
