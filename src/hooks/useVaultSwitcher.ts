import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { pickFolder } from '../utils/vault-dialog'
import { loadVaultList, saveVaultList } from '../utils/vaultListStore'
import type { VaultOption } from '../components/StatusBar'

export type { PersistedVaultList } from '../utils/vaultListStore'

export const DEFAULT_VAULTS: VaultOption[] = [
  { label: 'Getting Started', path: '/Users/luca/Workspace/laputa-app/demo-vault-v2' },
]

interface UseVaultSwitcherOptions {
  onSwitch: () => void
  onToast: (msg: string) => void
}

function labelFromPath(path: string): string {
  return path.split('/').pop() || 'Local Vault'
}

/** Manages vault path, extra vaults, switching, cloning, and local folder opening.
 *  Vault list and active vault are persisted via Tauri backend to survive app updates. */
export function useVaultSwitcher({ onSwitch, onToast }: UseVaultSwitcherOptions) {
  const [vaultPath, setVaultPath] = useState(DEFAULT_VAULTS[0].path)
  const [extraVaults, setExtraVaults] = useState<VaultOption[]>([])
  const [loaded, setLoaded] = useState(false)
  const allVaults = useMemo(() => [...DEFAULT_VAULTS, ...extraVaults], [extraVaults])

  const onSwitchRef = useRef(onSwitch)
  const onToastRef = useRef(onToast)
  useEffect(() => { onSwitchRef.current = onSwitch; onToastRef.current = onToast })

  const hasLoadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    loadVaultList()
      .then(({ vaults, activeVault }) => {
        if (cancelled) return
        setExtraVaults(vaults)
        if (activeVault) {
          setVaultPath(activeVault)
          onSwitchRef.current()
        }
      })
      .catch(err => console.warn('Failed to load vault list:', err))
      .finally(() => {
        hasLoadedRef.current = true
        setLoaded(true)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!hasLoadedRef.current) return
    saveVaultList(extraVaults, vaultPath).catch(err =>
      console.warn('Failed to persist vault list:', err),
    )
  }, [extraVaults, vaultPath])

  const addVault = useCallback((path: string, label: string) => {
    setExtraVaults(prev => {
      const exists = prev.some(v => v.path === path)
      return exists ? prev : [...prev, { label, path, available: true }]
    })
  }, [])

  const switchVault = useCallback((path: string) => {
    setVaultPath(path)
    onSwitchRef.current()
  }, [])

  const addAndSwitch = useCallback((path: string, label: string) => {
    addVault(path, label)
    switchVault(path)
  }, [addVault, switchVault])

  const handleVaultCloned = useCallback((path: string, label: string) => {
    addAndSwitch(path, label)
    onToastRef.current(`Vault "${label}" cloned and opened`)
  }, [addAndSwitch])

  const handleOpenLocalFolder = useCallback(async () => {
    const path = await pickFolder('Open vault folder')
    if (!path) return
    const label = labelFromPath(path)
    addAndSwitch(path, label)
    onToastRef.current(`Vault "${label}" opened`)
  }, [addAndSwitch])

  return { vaultPath, allVaults, switchVault, handleVaultCloned, handleOpenLocalFolder, loaded }
}
