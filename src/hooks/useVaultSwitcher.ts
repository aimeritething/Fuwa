import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import { pickFolder } from '../utils/vault-dialog'
import type { VaultOption } from '../components/StatusBar'

export const DEFAULT_VAULTS: VaultOption[] = [
  { label: 'Getting Started', path: '/Users/luca/Workspace/laputa-app/demo-vault-v2' },
]

interface UseVaultSwitcherOptions {
  onSwitch: () => void
  onToast: (msg: string) => void
}

function tauriCall<T>(command: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : mockInvoke<T>(command, args)
}

export function persistLastVault(path: string): void {
  tauriCall('set_last_vault_path', { path }).catch(() => {})
}

/** Manages vault path, extra vaults, switching, cloning, and local folder opening. */
export function useVaultSwitcher({ onSwitch, onToast }: UseVaultSwitcherOptions) {
  const [vaultPath, setVaultPath] = useState(DEFAULT_VAULTS[0].path)
  const [extraVaults, setExtraVaults] = useState<VaultOption[]>([])
  const allVaults = useMemo(() => [...DEFAULT_VAULTS, ...extraVaults], [extraVaults])

  // On mount, load the last vault path from persistent storage
  useEffect(() => {
    tauriCall<string | null>('get_last_vault_path', {}).then((saved) => {
      if (saved) setVaultPath(saved)
    }).catch(() => {})
  }, [])

  // Refs ensure stable callbacks that always invoke the latest closures,
  // breaking the circular dependency between useVaultSwitcher and downstream hooks.
  const onSwitchRef = useRef(onSwitch)
  const onToastRef = useRef(onToast)
  useEffect(() => { onSwitchRef.current = onSwitch; onToastRef.current = onToast })

  const addVault = useCallback((path: string, label: string) => {
    setExtraVaults(prev => prev.some(v => v.path === path) ? prev : [...prev, { label, path }])
  }, [])

  const switchVault = useCallback((path: string) => {
    setVaultPath(path)
    persistLastVault(path)
    onSwitchRef.current()
  }, [])

  const handleVaultCloned = useCallback((path: string, label: string) => {
    addVault(path, label)
    switchVault(path)
    onToastRef.current(`Vault "${label}" cloned and opened`)
  }, [addVault, switchVault])

  const handleOpenLocalFolder = useCallback(async () => {
    try {
      const path = await pickFolder('Open vault folder')
      if (!path) return
      const label = path.split('/').pop() || 'Local Vault'
      addVault(path, label)
      switchVault(path)
      onToastRef.current(`Vault "${label}" opened`)
    } catch (err) {
      console.error('Failed to open local folder:', err)
      onToastRef.current(`Failed to open folder: ${err}`)
    }
  }, [addVault, switchVault])

  return { vaultPath, allVaults, switchVault, handleVaultCloned, handleOpenLocalFolder }
}
