import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import { pickFolder } from '../utils/vault-dialog'
import { loadVaultList, saveVaultList } from '../utils/vaultListStore'
import type { VaultOption } from '../components/StatusBar'
import { trackEvent } from '../lib/telemetry'

export type { PersistedVaultList } from '../utils/vaultListStore'

export const GETTING_STARTED_LABEL = 'Getting Started'

declare const __DEMO_VAULT_PATH__: string | undefined

/** Build-time demo vault path (dev only). In production Tauri builds this is
 *  undefined and the real path is resolved at runtime via get_default_vault_path. */
const STATIC_DEFAULT_PATH = typeof __DEMO_VAULT_PATH__ !== 'undefined' ? __DEMO_VAULT_PATH__ : ''

export const DEFAULT_VAULTS: VaultOption[] = [
  { label: GETTING_STARTED_LABEL, path: STATIC_DEFAULT_PATH },
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
  const [vaultPath, setVaultPath] = useState(STATIC_DEFAULT_PATH)
  const [extraVaults, setExtraVaults] = useState<VaultOption[]>([])
  const [hiddenDefaults, setHiddenDefaults] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const [defaultPath, setDefaultPath] = useState(STATIC_DEFAULT_PATH)

  const defaultVaults: VaultOption[] = useMemo(
    () => [{ label: GETTING_STARTED_LABEL, path: defaultPath }],
    [defaultPath],
  )

  const visibleDefaults = useMemo(
    () => defaultVaults.filter(v => !hiddenDefaults.includes(v.path)),
    [defaultVaults, hiddenDefaults],
  )
  const allVaults = useMemo(
    () => [...visibleDefaults, ...extraVaults],
    [visibleDefaults, extraVaults],
  )

  const isGettingStartedHidden = useMemo(
    () => hiddenDefaults.includes(defaultPath),
    [hiddenDefaults, defaultPath],
  )

  const onSwitchRef = useRef(onSwitch)
  const onToastRef = useRef(onToast)
  useEffect(() => { onSwitchRef.current = onSwitch; onToastRef.current = onToast })

  const hasLoadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    loadVaultList()
      .then(async ({ vaults, activeVault, hiddenDefaults: hidden }) => {
        if (cancelled) return
        setExtraVaults(vaults)
        setHiddenDefaults(hidden)
        if (activeVault) {
          setVaultPath(activeVault)
          onSwitchRef.current()
        } else if (!STATIC_DEFAULT_PATH) {
          // Production build: resolve the Getting Started path at runtime
          try {
            const runtimePath = await tauriCall<string>('get_default_vault_path', {})
            if (!cancelled && runtimePath) {
              setDefaultPath(runtimePath)
              setVaultPath(runtimePath)
              // Keep the module-level export in sync for external consumers
              DEFAULT_VAULTS[0] = { label: GETTING_STARTED_LABEL, path: runtimePath }
            }
          } catch {
            // In mock/test mode, command may not exist
          }
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
    trackEvent('vault_switched')
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
    const isDefault = defaultVaults.some(v => v.path === path)
    if (isDefault) {
      setHiddenDefaults(prev => prev.includes(path) ? prev : [...prev, path])
    } else {
      setExtraVaults(prev => prev.filter(v => v.path !== path))
    }

    // If removing the active vault, switch to the first remaining vault
    setVaultPath(currentPath => {
      if (currentPath !== path) return currentPath
      const remaining = [
        ...defaultVaults.filter(v => v.path !== path && !(isDefault ? [] : hiddenDefaults).includes(v.path)),
        ...extraVaults.filter(v => v.path !== path),
      ]
      if (remaining.length > 0) {
        onSwitchRef.current()
        return remaining[0].path
      }
      return currentPath
    })

    const vault = [...defaultVaults, ...extraVaults].find(v => v.path === path)
    onToastRef.current(`Vault "${vault?.label ?? labelFromPath(path)}" removed from list`)
  }, [defaultVaults, extraVaults, hiddenDefaults])

  const restoreGettingStarted = useCallback(async () => {
    const gsPath = defaultPath
    // Un-hide the Getting Started vault
    setHiddenDefaults(prev => prev.filter(p => p !== gsPath))
    // Try to create the vault if it doesn't exist on disk
    try {
      const exists = await tauriCall<boolean>('check_vault_exists', { path: gsPath })
      if (!exists) {
        await tauriCall<string>('create_getting_started_vault', { targetPath: gsPath })
      }
    } catch {
      // In mock/test mode, creation may fail — that's fine
    }
    switchVault(gsPath)
    onToastRef.current('Getting Started vault restored')
  }, [defaultPath, switchVault])

  return {
    vaultPath, allVaults, switchVault, handleVaultCloned, handleOpenLocalFolder, loaded,
    removeVault, restoreGettingStarted, isGettingStartedHidden,
  }
}
