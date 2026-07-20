import type { Dispatch, SetStateAction } from 'react'
import type { VaultOption } from '../components/status-bar/types'
import type { VaultEntry } from '../types'
import { loadWorkspaceEntries } from './vaultLoaderCommands'
import {
  nearestLoadedWorkspaceAncestor,
  replaceWorkspaceEntries,
  retagNestedWorkspaceEntries,
} from './vaultWorkspaceEntries'

interface ProgressiveWorkspaceLoadOptions {
  defaultWorkspacePath?: string | null
  desiredWorkspacePaths: readonly string[]
  isCurrentVaultPath: (path: string) => boolean
  loadedPaths: Set<string>
  loadingPaths: Set<string>
  setEntries: Dispatch<SetStateAction<VaultEntry[]>>
  vaultPath: string
  vaults: VaultOption[]
}

function missingWorkspaceVaults(options: ProgressiveWorkspaceLoadOptions): VaultOption[] {
  return options.vaults.filter((vault) => (
    options.desiredWorkspacePaths.includes(vault.path)
    && !options.loadedPaths.has(vault.path)
    && !options.loadingPaths.has(vault.path)
  ))
}

function reuseLoadedAncestor(options: ProgressiveWorkspaceLoadOptions, vault: VaultOption): boolean {
  const ancestorPath = nearestLoadedWorkspaceAncestor(vault.path, options.loadedPaths)
  if (!ancestorPath) return false

  options.loadedPaths.add(vault.path)
  options.setEntries((entries) => retagNestedWorkspaceEntries({
    ancestorPath,
    defaultWorkspacePath: options.defaultWorkspacePath,
    entries,
    nestedVault: vault,
  }))
  return true
}

async function loadWorkspace(options: ProgressiveWorkspaceLoadOptions, vault: VaultOption): Promise<void> {
  try {
    if (reuseLoadedAncestor(options, vault)) return
    const loadedEntries = await loadWorkspaceEntries(vault, options.defaultWorkspacePath, {
      forceReload: vault.path === options.vaultPath,
      reloadIfEmpty: true,
    })
    if (!options.isCurrentVaultPath(options.vaultPath)) return
    options.loadedPaths.add(vault.path)
    options.setEntries((entries) => replaceWorkspaceEntries({
      defaultWorkspacePath: options.defaultWorkspacePath,
      entries,
      fallbackVaultPath: options.vaultPath,
      loadedEntries,
      loadedWorkspacePath: vault.path,
      vaults: options.vaults,
    }))
  } catch (error) {
    console.warn(`Failed to load workspace entries for ${vault.path}:`, error)
  } finally {
    options.loadingPaths.delete(vault.path)
  }
}

export function startProgressiveWorkspaceLoads(options: ProgressiveWorkspaceLoadOptions): void {
  const missingVaults = missingWorkspaceVaults(options)
  if (missingVaults.length === 0) return
  for (const vault of missingVaults) options.loadingPaths.add(vault.path)

  window.setTimeout(() => {
    void (async () => {
      for (const vault of missingVaults) {
        if (!options.isCurrentVaultPath(options.vaultPath)) break
        await loadWorkspace(options, vault)
      }
    })()
  }, 0)
}
