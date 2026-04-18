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
  selectedVaultPath: string | null
  setExtraVaults: Dispatch<SetStateAction<VaultOption[]>>
  setHiddenDefaults: Dispatch<SetStateAction<string[]>>
  setSelectedVaultPath: Dispatch<SetStateAction<string | null>>
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
  selectedVaultPath: string | null
  setDefaultPath: Dispatch<SetStateAction<string>>
  setExtraVaults: Dispatch<SetStateAction<VaultOption[]>>
  setHiddenDefaults: Dispatch<SetStateAction<string[]>>
  setLoaded: Dispatch<SetStateAction<boolean>>
  setSelectedVaultPath: Dispatch<SetStateAction<string | null>>
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
  selectedVaultPath: string | null
  onSwitchRef: MutableRefObject<() => void>
  setExtraVaults: Dispatch<SetStateAction<VaultOption[]>>
  setHiddenDefaults: Dispatch<SetStateAction<string[]>>
  setSelectedVaultPath: Dispatch<SetStateAction<string | null>>
  setVaultPath: Dispatch<SetStateAction<string>>
  vaultPath: string
}

interface RemoveVaultActionOptions {
  defaultVaults: VaultOption[]
  extraVaults: VaultOption[]
  hiddenDefaults: string[]
  onSwitchRef: MutableRefObject<() => void>
  onToastRef: MutableRefObject<(msg: string) => void>
  setExtraVaults: Dispatch<SetStateAction<VaultOption[]>>
  setHiddenDefaults: Dispatch<SetStateAction<string[]>>
  setSelectedVaultPath: Dispatch<SetStateAction<string | null>>
  setVaultPath: Dispatch<SetStateAction<string>>
  selectedVaultPath: string | null
  vaultPath: string
}

interface VaultPathInput {
  path: string
}

function labelFromPath({ path }: VaultPathInput): string {
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

function buildDefaultVaults({ defaultPath }: { defaultPath: string }): VaultOption[] {
  return [{ label: GETTING_STARTED_LABEL, path: defaultPath }]
}

function buildVisibleDefaultVaults({
  defaultVaults,
  hiddenDefaults,
}: {
  defaultVaults: VaultOption[]
  hiddenDefaults: string[]
}): VaultOption[] {
  return defaultVaults.filter(vault => !hiddenDefaults.includes(vault.path))
}

function buildAllVaults({
  visibleDefaults,
  extraVaults,
}: {
  visibleDefaults: VaultOption[]
  extraVaults: VaultOption[]
}): VaultOption[] {
  return [...visibleDefaults, ...extraVaults]
}

function applyResolvedDefaultPath({
  resolvedDefaultPath,
  setDefaultPath,
}: {
  resolvedDefaultPath: string
  setDefaultPath: Dispatch<SetStateAction<string>>
}) {
  if (!resolvedDefaultPath) {
    return
  }

  setDefaultPath(resolvedDefaultPath)
  syncDefaultVaultExport(resolvedDefaultPath)
}

function normalizeInitialSelectedVaultPath(
  activeVault: string | null,
  resolvedDefaultPath: string,
  vaults: VaultOption[],
): string | null {
  if (!activeVault) {
    return null
  }

  const isRememberedDefaultOnlySelection = activeVault === resolvedDefaultPath && vaults.length === 0
  return isRememberedDefaultOnlySelection ? null : activeVault
}

function applyInitialVaultTarget({
  activeVault,
  resolvedDefaultPath,
  setSelectedVaultPath,
  setVaultPath,
  onSwitchRef,
}: {
  activeVault: string | null
  resolvedDefaultPath: string
  setSelectedVaultPath: Dispatch<SetStateAction<string | null>>
  setVaultPath: Dispatch<SetStateAction<string>>
  onSwitchRef: MutableRefObject<() => void>
}) {
  if (activeVault) {
    setVaultPath(activeVault)
    setSelectedVaultPath(activeVault)
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
    () => buildDefaultVaults({ defaultPath }),
    [defaultPath],
  )
  const visibleDefaults = useMemo(
    () => buildVisibleDefaultVaults({ defaultVaults, hiddenDefaults }),
    [defaultVaults, hiddenDefaults],
  )
  const allVaults = useMemo(
    () => buildAllVaults({ visibleDefaults, extraVaults }),
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
    setSelectedVaultPath,
    setVaultPath,
  } = store

  useEffect(() => {
    let cancelled = false

    loadInitialVaultState()
      .then(({ activeVault, hiddenDefaults: hidden, resolvedDefaultPath, vaults }) => {
        if (cancelled) return

        setExtraVaults(vaults)
        setHiddenDefaults(hidden)
        applyResolvedDefaultPath({ resolvedDefaultPath, setDefaultPath })
        applyInitialVaultTarget({
          activeVault: normalizeInitialSelectedVaultPath(activeVault, resolvedDefaultPath, vaults),
          resolvedDefaultPath,
          setSelectedVaultPath,
          setVaultPath,
          onSwitchRef,
        })
      })
      .catch(err => console.warn('Failed to load vault list:', err))
      .finally(() => {
        if (!cancelled) {
          setLoaded(true)
        }
      })

    return () => { cancelled = true }
  }, [onSwitchRef, setDefaultPath, setExtraVaults, setHiddenDefaults, setLoaded, setSelectedVaultPath, setVaultPath])
}

function usePersistedVaultStorage(store: PersistedVaultStore) {
  const { extraVaults, hiddenDefaults, loaded, selectedVaultPath } = store

  useEffect(() => {
    if (!loaded) return

    saveVaultList(extraVaults, selectedVaultPath, hiddenDefaults).catch(err =>
      console.warn('Failed to persist vault list:', err),
    )
  }, [extraVaults, hiddenDefaults, loaded, selectedVaultPath])
}

function usePersistedVaultState(onSwitchRef: MutableRefObject<() => void>): PersistedVaultState {
  const [vaultPath, setVaultPath] = useState(STATIC_DEFAULT_PATH)
  const [selectedVaultPath, setSelectedVaultPath] = useState<string | null>(null)
  const [extraVaults, setExtraVaults] = useState<VaultOption[]>([])
  const [hiddenDefaults, setHiddenDefaults] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const [defaultPath, setDefaultPath] = useState(STATIC_DEFAULT_PATH)

  const store: PersistedVaultStore = {
    defaultPath,
    extraVaults,
    hiddenDefaults,
    loaded,
    selectedVaultPath,
    setDefaultPath,
    setExtraVaults,
    setHiddenDefaults,
    setLoaded,
    setSelectedVaultPath,
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
    selectedVaultPath,
    setExtraVaults,
    setHiddenDefaults,
    setSelectedVaultPath,
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

function formatCreateEmptyVaultError(err: unknown): string {
  const message =
    typeof err === 'string'
      ? err
      : err instanceof Error
        ? err.message
        : `${err}`

  if (message.includes('Choose an empty folder')) {
    return message
  }

  return `Could not create empty vault: ${message}`
}

async function ensureGettingStartedVaultReady(path: string): Promise<void> {
  const exists = await tauriCall<boolean>('check_vault_exists', { path })
  if (!exists) {
    await tauriCall<string>('create_getting_started_vault', { targetPath: path })
  }
}

function addVaultToList({
  setExtraVaults,
  path,
  label,
}: {
  setExtraVaults: Dispatch<SetStateAction<VaultOption[]>>
  path: string
  label: string
}) {
  setExtraVaults(previousVaults => {
    const exists = previousVaults.some(vault => vault.path === path)
    return exists ? previousVaults : [...previousVaults, { label, path, available: true }]
  })
}

function switchVaultPath({
  setSelectedVaultPath,
  setVaultPath,
  onSwitchRef,
  path,
}: {
  setSelectedVaultPath: Dispatch<SetStateAction<string | null>>
  setVaultPath: Dispatch<SetStateAction<string>>
  onSwitchRef: MutableRefObject<() => void>
  path: string
}) {
  trackEvent('vault_switched')
  setSelectedVaultPath(path)
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
  setSelectedVaultPath,
  setVaultPath,
  selectedVaultPath,
  vaultPath,
}: RemoveVaultStateOptions) {
  if (isDefault) {
    setHiddenDefaults(previousHidden => previousHidden.includes(removedPath) ? previousHidden : [...previousHidden, removedPath])
  } else {
    setExtraVaults(previousVaults => previousVaults.filter(vault => vault.path !== removedPath))
  }

  if (vaultPath !== removedPath) {
    if (selectedVaultPath === removedPath) {
      setSelectedVaultPath(null)
    }
    return
  }

  const remainingVaults = listRemainingVaults({
    defaultVaults,
    extraVaults,
    hiddenDefaults,
    isDefault,
    removedPath,
  })
  if (remainingVaults.length === 0) {
    setSelectedVaultPath(null)
    return
  }

  const nextPath = remainingVaults[0].path
  setSelectedVaultPath(nextPath)
  setVaultPath(nextPath)
  onSwitchRef.current()
}

function getRemovedVaultLabel({
  path,
  defaultVaults,
  extraVaults,
}: {
  path: string
  defaultVaults: VaultOption[]
  extraVaults: VaultOption[]
}): string {
  const removedVault = [...defaultVaults, ...extraVaults].find(vault => vault.path === path)
  return removedVault?.label ?? labelFromPath({ path })
}

function useSwitchVaultAction(
  onSwitchRef: MutableRefObject<() => void>,
  setSelectedVaultPath: Dispatch<SetStateAction<string | null>>,
  setVaultPath: Dispatch<SetStateAction<string>>,
) {
  return useCallback((path: string) => {
    switchVaultPath({ setSelectedVaultPath, setVaultPath, onSwitchRef, path })
  }, [onSwitchRef, setSelectedVaultPath, setVaultPath])
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

    const label = labelFromPath({ path })
    addAndSwitch(path, label)
    onToastRef.current(`Vault "${label}" opened`)
  }, [addAndSwitch, onToastRef])
}

function useCreateEmptyVaultAction(
  addAndSwitch: (path: string, label: string) => void,
  onToastRef: MutableRefObject<(msg: string) => void>,
) {
  return useCallback(async () => {
    try {
      const targetPath = await pickFolder('Choose where to create your vault')
      if (!targetPath) return

      const vaultPath = await tauriCall<string>('create_empty_vault', { targetPath })
      const label = labelFromPath({ path: vaultPath })
      addAndSwitch(vaultPath, label)
      onToastRef.current(`Vault "${label}" created and opened`)
    } catch (err) {
      onToastRef.current(formatCreateEmptyVaultError(err))
    }
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
  setSelectedVaultPath,
  setVaultPath,
  selectedVaultPath,
  vaultPath,
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
      setSelectedVaultPath,
      setVaultPath,
      selectedVaultPath,
      vaultPath,
    })
    onToastRef.current(`Vault "${getRemovedVaultLabel({ path, defaultVaults, extraVaults })}" removed from list`)
  }, [
    defaultVaults,
    extraVaults,
    hiddenDefaults,
    onSwitchRef,
    onToastRef,
    setExtraVaults,
    setHiddenDefaults,
    setSelectedVaultPath,
    setVaultPath,
    selectedVaultPath,
    vaultPath,
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
  selectedVaultPath,
  setSelectedVaultPath,
  setVaultPath,
  vaultPath,
}: VaultActionOptions) {
  const addVault = useCallback((path: string, label: string) => {
    addVaultToList({ setExtraVaults, path, label })
  }, [setExtraVaults])

  const switchVault = useSwitchVaultAction(onSwitchRef, setSelectedVaultPath, setVaultPath)
  const addAndSwitch = useCallback((path: string, label: string) => {
    addVault(path, label)
    switchVault(path)
  }, [addVault, switchVault])

  return {
    handleCreateEmptyVault: useCreateEmptyVaultAction(addAndSwitch, onToastRef),
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
      setSelectedVaultPath,
      setVaultPath,
      selectedVaultPath,
      vaultPath,
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
  const {
    defaultPath,
    extraVaults,
    hiddenDefaults,
    loaded,
    selectedVaultPath,
    vaultPath,
  } = persistedState
  const { allVaults, defaultVaults, isGettingStartedHidden } = useVaultCollections(
    defaultPath,
    hiddenDefaults,
    extraVaults,
  )
  const { handleCreateEmptyVault, handleOpenLocalFolder, handleVaultCloned, removeVault, restoreGettingStarted, switchVault } = useVaultActions({
    ...persistedState,
    allVaults,
    defaultVaults,
    isGettingStartedHidden,
    onSwitchRef,
    onToastRef,
  })

  return {
    allVaults,
    defaultPath,
    handleCreateEmptyVault,
    handleOpenLocalFolder,
    handleVaultCloned,
    isGettingStartedHidden,
    loaded,
    removeVault,
    restoreGettingStarted,
    selectedVaultPath,
    switchVault,
    vaultPath,
  }
}
