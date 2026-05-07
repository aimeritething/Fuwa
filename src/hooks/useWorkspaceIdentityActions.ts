import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { VaultOption } from '../components/status-bar/types'

function updateVaultOptionInList(
  path: string,
  patch: Partial<VaultOption>,
): (vaults: VaultOption[]) => VaultOption[] {
  return (vaults) => vaults.map((vault) => (
    vault.path === path ? { ...vault, ...patch, path: vault.path } : vault
  ))
}

export function useWorkspaceIdentityActions({
  setDefaultWorkspacePath,
  setExtraVaults,
}: {
  setDefaultWorkspacePath: Dispatch<SetStateAction<string | null>>
  setExtraVaults: Dispatch<SetStateAction<VaultOption[]>>
}) {
  const updateWorkspaceIdentity = useCallback((path: string, patch: Partial<VaultOption>) => {
    setExtraVaults(updateVaultOptionInList(path, patch))
  }, [setExtraVaults])

  const setDefaultWorkspace = useCallback((path: string) => {
    setDefaultWorkspacePath(path)
  }, [setDefaultWorkspacePath])

  return { setDefaultWorkspace, updateWorkspaceIdentity }
}
