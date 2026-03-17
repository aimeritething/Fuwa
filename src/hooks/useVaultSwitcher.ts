import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import { pickFolder } from '../utils/vault-dialog'
import { loadVaultList, saveVaultList } from '../utils/vaultListStore'
import type { VaultOption } from '../components/StatusBar'

export type { PersistedVaultList } from '../utils/vaultListStore'

export const GETTING_STARTED_LABEL = 'Getting Started'

declare const __DEMO_VAULT_PATH__: string

export const DEFAULT_VAULTS: VaultOption[] = [
  { label: GETTING_STARTED_LABEL, path: typeof __DEMO_VAULT_PATH__ !== 'undefined' ? __DEMO_VAULT_PATH__ : '/Users/luca/Workspace/laputa-app/demo-vault-v2' },
]

interface UseVaultSwitcherOptions {
  onSwitch: () => void
  onToast: (msg: string) => void
}

function labelFromPath(path: string): string {
  return path.split('/').pop() || 'Local Vault'
}

function tauriCall<T>(command: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : mockInvoke<T>(command, args)
}

/** Manages vault path, extra vaults, switching, cloning, and local folder opening.
 *  Vault list and active vault are persisted via Tauri backend to survive app updates. */
export function useVaultSwitcher({ onSwitch, onToast }: UseVaultSwitcherOptions) {
  const [vaultPath, setVaultPath] = useState(DEFAULT_VAULTS[0].path)
  const [extraVaults, setExtraVaults] = useState<VaultOption[]>([])
  const [hiddenDefaults, setHiddenDefaults] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)

  const visibleDefaults = useMemo(
    () => DEFAULT_VAULTS.filter(v => !hiddenDefaults.includes(v.path)),
    [hiddenDefaults],
  )
  const allVaults = useMemo(
    () => [...visibleDefaults, ...extraVaults],
    [visibleDefaults, extraVaults],
  )

  const isGettingStartedHidden = useMemo(
    () => hiddenDefaults.includes(DEFAULT_VAULTS[0].path),
    [hiddenDefaults],
  )

  const onSwitchRef = useRef(onSwitch)
  const onToastRef = useRef(onToast)
  useEffect(() => { onSwitchRef.current = onSwitch; onToastRef.current = onToast })

  const hasLoadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    loadVaultList()
      .then(({ vaults, activeVault, hiddenDefaults: hidden }) => {
        if (cancelled) return
        setExtraVaults(vaults)
        setHiddenDefaults(hidden)
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
    saveVaultList(extraVaults, vaultPath, hiddenDefaults).catch(err =>
      console.warn('Failed to persist vault list:', err),
    )
  }, [extraVaults, vaultPath, hiddenDefaults])

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

  const removeVault = useCallback((path: string) => {
    const isDefault = DEFAULT_VAULTS.some(v => v.path === path)
    if (isDefault) {
      setHiddenDefaults(prev => prev.includes(path) ? prev : [...prev, path])
    } else {
      setExtraVaults(prev => prev.filter(v => v.path !== path))
    }

    // If removing the active vault, switch to the first remaining vault
    setVaultPath(currentPath => {
      if (currentPath !== path) return currentPath
      const remaining = [
        ...DEFAULT_VAULTS.filter(v => v.path !== path && !(isDefault ? [] : hiddenDefaults).includes(v.path)),
        ...extraVaults.filter(v => v.path !== path),
      ]
      if (remaining.length > 0) {
        onSwitchRef.current()
        return remaining[0].path
      }
      return currentPath
    })

    const vault = [...DEFAULT_VAULTS, ...extraVaults].find(v => v.path === path)
    onToastRef.current(`Vault "${vault?.label ?? labelFromPath(path)}" removed from list`)
  }, [extraVaults, hiddenDefaults])

  const restoreGettingStarted = useCallback(async () => {
    const defaultPath = DEFAULT_VAULTS[0].path
    // Un-hide the Getting Started vault
    setHiddenDefaults(prev => prev.filter(p => p !== defaultPath))
    // Try to create the vault if it doesn't exist on disk
    try {
      const exists = await tauriCall<boolean>('check_vault_exists', { path: defaultPath })
      if (!exists) {
        await tauriCall<string>('create_getting_started_vault', { targetPath: defaultPath })
      }
    } catch {
      // In mock/test mode, creation may fail — that's fine
    }
    switchVault(defaultPath)
    onToastRef.current('Getting Started vault restored')
  }, [switchVault])

  return {
    vaultPath, allVaults, switchVault, handleVaultCloned, handleOpenLocalFolder, loaded,
    removeVault, restoreGettingStarted, isGettingStartedHidden,
  }
}
