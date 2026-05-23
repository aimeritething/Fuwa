import type { VaultOption } from './types'

export interface VaultMountChangeRequest {
  defaultPath: string
  includedVaults: VaultOption[]
  mounted: boolean
  onSetDefaultWorkspace?: (path: string) => void
  onSwitchVault: (path: string) => void
  onUpdateWorkspaceIdentity?: (path: string, patch: Partial<VaultOption>) => void
  path: string
  vaultPath: string
}

function nextIncludedVaultPath(includedVaults: VaultOption[], currentPath: string): string | null {
  return includedVaults.find((vault) => vault.path !== currentPath)?.path ?? null
}

export function applyMountedChange({
  defaultPath,
  includedVaults,
  mounted,
  onSetDefaultWorkspace,
  onSwitchVault,
  onUpdateWorkspaceIdentity,
  path,
  vaultPath,
}: VaultMountChangeRequest): void {
  if (!mounted && (path === defaultPath || path === vaultPath)) {
    const nextPath = nextIncludedVaultPath(includedVaults, path)
    if (!nextPath) return
    if (path === defaultPath) onSetDefaultWorkspace?.(nextPath)
    if (path === vaultPath) onSwitchVault(nextPath)
  }
  onUpdateWorkspaceIdentity?.(path, { mounted })
}
