import type { VaultOption } from './types'

export interface VaultMountChangeCallbacks {
  onSetDefaultWorkspace?: (path: string) => void
  onSwitchVault: (path: string) => void
  onUpdateWorkspaceIdentity?: (path: string, patch: Partial<VaultOption>) => void
}

export interface VaultMountChangeRequest {
  defaultPath: string
  vaultPath: string
  includedVaults: VaultOption[]
  mounted: boolean
  path: string
  callbacks: VaultMountChangeCallbacks
}

function nextIncludedVaultPath(includedVaults: VaultOption[], currentPath: string): string | null {
  return includedVaults.find((vault) => vault.path !== currentPath)?.path ?? null
}

export function applyMountedChange({
  defaultPath,
  vaultPath,
  includedVaults,
  mounted,
  path,
  callbacks,
}: VaultMountChangeRequest): void {
  if (!mounted && (path === defaultPath || path === vaultPath)) {
    const nextPath = nextIncludedVaultPath(includedVaults, path)
    if (!nextPath) return
    if (path === defaultPath) callbacks.onSetDefaultWorkspace?.(nextPath)
    if (path === vaultPath) callbacks.onSwitchVault(nextPath)
  }
  callbacks.onUpdateWorkspaceIdentity?.(path, { mounted })
}
