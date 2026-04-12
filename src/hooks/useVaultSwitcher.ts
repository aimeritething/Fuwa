import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
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

interface PersistedVaultState {
  defaultPath: string
  extraVaults: VaultOption[]
  hiddenDefaults: string[]
  loaded: boolean
  setExtraVaults: Dispatch<SetStateAction<VaultOption[]>>
  setHiddenDefaults: Dispatch<SetStateAction<string[]>>
  setVaultPath: Dispatch<SetStateAction<string>>
  vaultPath: string
}

interface VaultCollections {
  allVaults: VaultOption[]
  defaultVaults: VaultOption[]
  isGettingStartedHidden: boolean
}

interface PersistedVaultStore {
  defaultPath: string
  extraVaults: VaultOption[]
  hiddenDefaults: string[]
  loaded: boolean
  setDefaultPath: Dispatch<SetStateAction<string>>
  setExtraVaults: Dispatch<SetStateAction<VaultOption[]>>
  setHiddenDefaults: Dispatch<SetStateAction<string[]>>
  setLoaded: Dispatch<SetStateAction<boolean>>
  setVaultPath: Dispatch<SetStateAction<string>>
  vaultPath: string
}

interface VaultActionOptions extends PersistedVaultState, VaultCollections {
  onSwitchRef: MutableRefObject<() => void>
  onToastRef: MutableRefObject<(msg: string) => void>
}

interface RestoreGettingStartedOptions {
  defaultPath: string
  onToastRef: MutableRefObject<(msg: string) => void>
  setHiddenDefaults: Dispatch<SetStateAction<string[]>>
  switchVault: (path: string) => void
}

interface RemainingVaultOptions {
  defaultVaults: VaultOption[]
  extraVaults: VaultOption[]
  hiddenDefaults: string[]
  isDefault: boolean
  removedPath: string
}

interface RemoveVaultStateOptions extends RemainingVaultOptions {
  onSwitchRef: MutableRefObject<() => void>
  setExtraVaults: Dispatch<SetStateAction<VaultOption[]>>
  setHiddenDefaults: Dispatch<SetStateAction<string[]>>
  setVaultPath: Dispatch<SetStateAction<string>>
}

interface RemoveVaultActionOptions extends RemoveVaultStateOptions {
  onToastRef: MutableRefObject<(msg: string) => void>
}

function labelFromPath(path: string): string {
  return path.split('/').pop() || 'Local Vault'
}

function tauriCall<T>(command: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : mockInvoke<T>(command, args)
}

async function resolveDefaultPath(): Promise<string> {
  if (STATIC_DEFAULT_PATH) {
    return STATIC_DEFAULT_PATH
  }

  try {
    return await tauriCall<string>('get_default_vault_path', {})
  } catch {
    return ''
  }
}

function syncDefaultVaultExport(path: string) {
  DEFAULT_VAULTS[0] = { label: GETTING_STARTED_LABEL, path }
}

async function loadInitialVaultState() {
  const [{ vaults, activeVault, hiddenDefaults }, resolvedDefaultPath] = await Promise.all([
    loadVaultList(),
    resolveDefaultPath(),
  ])

  return { activeVault, hiddenDefaults, resolvedDefaultPath, vaults }
}

function buildDefaultVaults(defaultPath: string): VaultOption[] {
  return [{ label: GETTING_STARTED_LABEL, path: defaultPath }]
}

function buildVisibleDefaultVaults(defaultVaults: VaultOption[], hiddenDefaults: string[]): VaultOption[] {
  return defaultVaults.filter(vault => !hiddenDefaults.includes(vault.path))
}

function buildAllVaults(visibleDefaults: VaultOption[], extraVaults: VaultOption[]): VaultOption[] {
  return [...visibleDefaults, ...extraVaults]
}

function applyResolvedDefaultPath(
  resolvedDefaultPath: string,
  setDefaultPath: Dispatch<SetStateAction<string>>,
) {
  if (!resolvedDefaultPath) {
    return
  }

  setDefaultPath(resolvedDefaultPath)
  syncDefaultVaultExport(resolvedDefaultPath)
}

function applyInitialVaultTarget(
  activeVault: string,
  resolvedDefaultPath: string,
  setVaultPath: Dispatch<SetStateAction<string>>,
  onSwitchRef: MutableRefObject<() => void>,
) {
  if (activeVault) {
    setVaultPath(activeVault)
    onSwitchRef.current()
    return
  }

  if (resolvedDefaultPath) {
    setVaultPath(resolvedDefaultPath)
  }
}

function useVaultCollections(
  defaultPath: string,
  hiddenDefaults: string[],
  extraVaults: VaultOption[],
): VaultCollections {
  const defaultVaults = useMemo(
    () => buildDefaultVaults(defaultPath),
    [defaultPath],
  )
  const visibleDefaults = useMemo(
    () => buildVisibleDefaultVaults(defaultVaults, hiddenDefaults),
    [defaultVaults, hiddenDefaults],
  )
  const allVaults = useMemo(
    () => buildAllVaults(visibleDefaults, extraVaults),
    [extraVaults, visibleDefaults],
  )
  const isGettingStartedHidden = useMemo(
    () => hiddenDefaults.includes(defaultPath),
    [defaultPath, hiddenDefaults],
  )

  return { allVaults, defaultVaults, isGettingStartedHidden }
}

function useLoadPersistedVaultState(
  store: PersistedVaultStore,
  onSwitchRef: MutableRefObject<() => void>,
) {
  const {
    setDefaultPath,
    setExtraVaults,
    setHiddenDefaults,
    setLoaded,
    setVaultPath,
  } = store

  useEffect(() => {
    let cancelled = false

    loadInitialVaultState()
      .then(({ activeVault, hiddenDefaults: hidden, resolvedDefaultPath, vaults }) => {
        if (cancelled) return

        setExtraVaults(vaults)
        setHiddenDefaults(hidden)
        applyResolvedDefaultPath(resolvedDefaultPath, setDefaultPath)
        applyInitialVaultTarget(activeVault, resolvedDefaultPath, setVaultPath, onSwitchRef)
      })
      .catch(err => console.warn('Failed to load vault list:', err))
      .finally(() => {
        if (!cancelled) {
          setLoaded(true)
        }
      })

    return () => { cancelled = true }
  }, [onSwitchRef, setDefaultPath, setExtraVaults, setHiddenDefaults, setLoaded, setVaultPath])
}

function usePersistedVaultStorage(store: PersistedVaultStore) {
  const { extraVaults, hiddenDefaults, loaded, vaultPath } = store

  useEffect(() => {
    if (!loaded) return

    saveVaultList(extraVaults, vaultPath, hiddenDefaults).catch(err =>
      console.warn('Failed to persist vault list:', err),
    )
  }, [extraVaults, hiddenDefaults, loaded, vaultPath])
}

function usePersistedVaultState(onSwitchRef: MutableRefObject<() => void>): PersistedVaultState {
  const [vaultPath, setVaultPath] = useState(STATIC_DEFAULT_PATH)
  const [extraVaults, setExtraVaults] = useState<VaultOption[]>([])
  const [hiddenDefaults, setHiddenDefaults] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const [defaultPath, setDefaultPath] = useState(STATIC_DEFAULT_PATH)

  const store: PersistedVaultStore = {
    defaultPath,
    extraVaults,
    hiddenDefaults,
    loaded,
    setDefaultPath,
    setExtraVaults,
    setHiddenDefaults,
    setLoaded,
    setVaultPath,
    vaultPath,
  }

  useLoadPersistedVaultState(store, onSwitchRef)
  usePersistedVaultStorage(store)

  return {
    defaultPath,
    extraVaults,
    hiddenDefaults,
    loaded,
    setExtraVaults,
    setHiddenDefaults,
    setVaultPath,
    vaultPath,
  }
}

function formatGettingStartedRestoreError(err: unknown): string {
  const message =
    typeof err === 'string'
      ? err
      : err instanceof Error
        ? err.message
        : `${err}`

  const networkErrors = [
    'unable to access',
    'Could not resolve host',
    'network',
    'timed out',
  ]

  if (networkErrors.some(fragment => message.includes(fragment))) {
    return 'Getting Started requires internet. Clone it later.'
  }

  return `Could not prepare Getting Started vault: ${message}`
}

async function ensureGettingStartedVaultReady(path: string): Promise<void> {
  const exists = await tauriCall<boolean>('check_vault_exists', { path })
  if (!exists) {
    await tauriCall<string>('create_getting_started_vault', { targetPath: path })
  }
}

function addVaultToList(
  setExtraVaults: Dispatch<SetStateAction<VaultOption[]>>,
  path: string,
  label: string,
) {
  setExtraVaults(previousVaults => {
    const exists = previousVaults.some(vault => vault.path === path)
    return exists ? previousVaults : [...previousVaults, { label, path, available: true }]
  })
}

function switchVaultPath(
  setVaultPath: Dispatch<SetStateAction<string>>,
  onSwitchRef: MutableRefObject<() => void>,
  path: string,
) {
  trackEvent('vault_switched')
  setVaultPath(path)
  onSwitchRef.current()
}

function listRemainingVaults({
  defaultVaults,
  extraVaults,
  hiddenDefaults,
  isDefault,
  removedPath,
}: RemainingVaultOptions) {
  const visibleDefaults = defaultVaults.filter(vault => (
    vault.path !== removedPath
    && (!isDefault || !hiddenDefaults.includes(vault.path))
  ))

  return [...visibleDefaults, ...extraVaults.filter(vault => vault.path !== removedPath)]
}

function removeVaultFromState({
  defaultVaults,
  extraVaults,
  hiddenDefaults,
  isDefault,
  onSwitchRef,
  removedPath,
  setExtraVaults,
  setHiddenDefaults,
  setVaultPath,
}: RemoveVaultStateOptions) {
  if (isDefault) {
    setHiddenDefaults(previousHidden => previousHidden.includes(removedPath) ? previousHidden : [...previousHidden, removedPath])
  } else {
    setExtraVaults(previousVaults => previousVaults.filter(vault => vault.path !== removedPath))
  }

  setVaultPath(currentPath => {
    if (currentPath !== removedPath) {
      return currentPath
    }

    const remainingVaults = listRemainingVaults({
      defaultVaults,
      extraVaults,
      hiddenDefaults,
      isDefault,
      removedPath,
    })
    if (remainingVaults.length === 0) {
      return currentPath
    }

    onSwitchRef.current()
    return remainingVaults[0].path
  })
}

function getRemovedVaultLabel(
  path: string,
  defaultVaults: VaultOption[],
  extraVaults: VaultOption[],
): string {
  const removedVault = [...defaultVaults, ...extraVaults].find(vault => vault.path === path)
  return removedVault?.label ?? labelFromPath(path)
}

function useSwitchVaultAction(
  onSwitchRef: MutableRefObject<() => void>,
  setVaultPath: Dispatch<SetStateAction<string>>,
) {
  return useCallback((path: string) => {
    switchVaultPath(setVaultPath, onSwitchRef, path)
  }, [onSwitchRef, setVaultPath])
}

function useVaultClonedAction(
  addAndSwitch: (path: string, label: string) => void,
  onToastRef: MutableRefObject<(msg: string) => void>,
) {
  return useCallback((path: string, label: string) => {
    addAndSwitch(path, label)
    onToastRef.current(`Vault "${label}" cloned and opened`)
  }, [addAndSwitch, onToastRef])
}

function useOpenLocalFolderAction(
  addAndSwitch: (path: string, label: string) => void,
  onToastRef: MutableRefObject<(msg: string) => void>,
) {
  return useCallback(async () => {
    const path = await pickFolder('Open vault folder')
    if (!path) return

    const label = labelFromPath(path)
    addAndSwitch(path, label)
    onToastRef.current(`Vault "${label}" opened`)
  }, [addAndSwitch, onToastRef])
}

function useRemoveVaultAction({
  defaultVaults,
  extraVaults,
  hiddenDefaults,
  onSwitchRef,
  onToastRef,
  setExtraVaults,
  setHiddenDefaults,
  setVaultPath,
}: RemoveVaultActionOptions) {
  return useCallback((path: string) => {
    const isDefault = defaultVaults.some(vault => vault.path === path)

    removeVaultFromState({
      defaultVaults,
      extraVaults,
      hiddenDefaults,
      isDefault,
      onSwitchRef,
      removedPath: path,
      setExtraVaults,
      setHiddenDefaults,
      setVaultPath,
    })
    onToastRef.current(`Vault "${getRemovedVaultLabel(path, defaultVaults, extraVaults)}" removed from list`)
  }, [
    defaultVaults,
    extraVaults,
    hiddenDefaults,
    onSwitchRef,
    onToastRef,
    setExtraVaults,
    setHiddenDefaults,
    setVaultPath,
  ])
}

function useRestoreGettingStartedAction(options: RestoreGettingStartedOptions) {
  const { defaultPath, onToastRef, setHiddenDefaults, switchVault } = options

  return useCallback(() => {
    return restoreGettingStartedVault({
      defaultPath,
      onToastRef,
      setHiddenDefaults,
      switchVault,
    })
  }, [defaultPath, onToastRef, setHiddenDefaults, switchVault])
}

function useVaultActions({
  defaultPath,
  defaultVaults,
  extraVaults,
  hiddenDefaults,
  onSwitchRef,
  onToastRef,
  setExtraVaults,
  setHiddenDefaults,
  setVaultPath,
}: VaultActionOptions) {
  const addVault = useCallback((path: string, label: string) => {
    addVaultToList(setExtraVaults, path, label)
  }, [setExtraVaults])

  const switchVault = useSwitchVaultAction(onSwitchRef, setVaultPath)
  const addAndSwitch = useCallback((path: string, label: string) => {
    addVault(path, label)
    switchVault(path)
  }, [addVault, switchVault])

  return {
    handleOpenLocalFolder: useOpenLocalFolderAction(addAndSwitch, onToastRef),
    handleVaultCloned: useVaultClonedAction(addAndSwitch, onToastRef),
    removeVault: useRemoveVaultAction({
      defaultVaults,
      extraVaults,
      hiddenDefaults,
      onSwitchRef,
      onToastRef,
      setExtraVaults,
      setHiddenDefaults,
      setVaultPath,
    }),
    restoreGettingStarted: useRestoreGettingStartedAction({
      defaultPath,
      onToastRef,
      setHiddenDefaults,
      switchVault,
    }),
    switchVault,
  }
}

async function restoreGettingStartedVault({
  defaultPath,
  onToastRef,
  setHiddenDefaults,
  switchVault,
}: RestoreGettingStartedOptions) {
  if (!defaultPath) {
    onToastRef.current('Could not resolve the Getting Started vault path')
    return
  }

  try {
    await ensureGettingStartedVaultReady(defaultPath)
    setHiddenDefaults(previousHidden => previousHidden.filter(path => path !== defaultPath))
    switchVault(defaultPath)
    onToastRef.current('Getting Started vault ready')
  } catch (err) {
    onToastRef.current(formatGettingStartedRestoreError(err))
  }
}

/** Manages vault path, extra vaults, switching, cloning, and local folder opening.
 *  Vault list and active vault are persisted via Tauri backend to survive app updates. */
export function useVaultSwitcher({ onSwitch, onToast }: UseVaultSwitcherOptions) {
  const onSwitchRef = useRef(onSwitch)
  const onToastRef = useRef(onToast)
  useEffect(() => { onSwitchRef.current = onSwitch; onToastRef.current = onToast })

  const persistedState = usePersistedVaultState(onSwitchRef)
  const { defaultPath, extraVaults, hiddenDefaults, loaded, vaultPath } = persistedState
  const { allVaults, defaultVaults, isGettingStartedHidden } = useVaultCollections(
    defaultPath,
    hiddenDefaults,
    extraVaults,
  )
  const { handleOpenLocalFolder, handleVaultCloned, removeVault, restoreGettingStarted, switchVault } = useVaultActions({
    ...persistedState,
    allVaults,
    defaultVaults,
    isGettingStartedHidden,
    onSwitchRef,
    onToastRef,
  })

  return {
    vaultPath, allVaults, switchVault, handleVaultCloned, handleOpenLocalFolder, loaded,
    removeVault, restoreGettingStarted, isGettingStartedHidden,
  }
}
