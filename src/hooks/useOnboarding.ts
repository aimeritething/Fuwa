import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import { APP_STORAGE_KEYS, LEGACY_APP_STORAGE_KEYS, getAppStorageItem } from '../constants/appStorage'
import { buildGettingStartedVaultPath, formatGettingStartedCloneError } from '../utils/gettingStartedVault'
import { pickFolder } from '../utils/vault-dialog'

type OnboardingState =
  | { status: 'loading' }
  | { status: 'welcome'; defaultPath: string }
  | { status: 'vault-missing'; vaultPath: string; defaultPath: string }
  | { status: 'ready'; vaultPath: string }

type CreatingAction = 'template' | 'empty' | null

function tauriCall<T>(command: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : mockInvoke<T>(command, args)
}

interface PersistedVaultList {
  vaults?: Array<{ label: string; path: string }>
  active_vault?: string | null
  hidden_defaults?: string[]
}

function wasDismissed(): boolean {
  try {
    return getAppStorageItem('welcomeDismissed') === '1'
  } catch {
    return false
  }
}

function markDismissed(): void {
  try {
    localStorage.setItem(APP_STORAGE_KEYS.welcomeDismissed, '1')
    localStorage.removeItem(LEGACY_APP_STORAGE_KEYS.welcomeDismissed)
  } catch {
    // localStorage may be unavailable in some contexts
  }
}

async function clearMissingActiveVault(missingPath: string): Promise<boolean> {
  try {
    const list = await tauriCall<PersistedVaultList>('load_vault_list', {})
    if (!list || list.active_vault !== missingPath) return false
    await tauriCall('save_vault_list', {
      list: {
        vaults: list.vaults ?? [],
        active_vault: null,
        hidden_defaults: list.hidden_defaults ?? [],
      },
    })
    return true
  } catch {
    // Best effort only — onboarding should still proceed
    return false
  }
}

export function useOnboarding(
  initialVaultPath: string,
  onTemplateVaultReady?: (vaultPath: string) => void,
  initialVaultResolved = true,
) {
  const [state, setState] = useState<OnboardingState>({ status: 'loading' })
  const [creatingAction, setCreatingAction] = useState<CreatingAction>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastTemplatePath, setLastTemplatePath] = useState<string | null>(null)
  const [userReadyVaultPath, setUserReadyVaultPath] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!initialVaultResolved) {
      setState({ status: 'loading' })
      return () => { cancelled = true }
    }

    async function check() {
      try {
        const defaultPath = await tauriCall<string>('get_default_vault_path', {})
        const exists = await tauriCall<boolean>('check_vault_exists', { path: initialVaultPath })

        if (cancelled) return

        if (exists) {
          setState({ status: 'ready', vaultPath: initialVaultPath })
          return
        }

        const missingWasPersistedActiveVault = await clearMissingActiveVault(initialVaultPath)
        if (cancelled) return

        if (wasDismissed() && missingWasPersistedActiveVault) {
          // Only show vault-missing when a previously selected vault path truly disappeared.
          setState({ status: 'vault-missing', vaultPath: initialVaultPath, defaultPath })
        } else {
          setState({ status: 'welcome', defaultPath })
        }
      } catch {
        // If commands fail (e.g. mock mode), just proceed
        if (!cancelled) setState({ status: 'ready', vaultPath: initialVaultPath })
      }
    }

    check()
    return () => { cancelled = true }
  }, [initialVaultPath, initialVaultResolved])

  const createTemplateVault = useCallback(async (targetPath: string) => {
    setCreatingAction('template')
    setError(null)
    setLastTemplatePath(targetPath)
    try {
      const vaultPath = await tauriCall<string>('create_getting_started_vault', { targetPath })
      markDismissed()
      setState({ status: 'ready', vaultPath })
      setUserReadyVaultPath(vaultPath)
      onTemplateVaultReady?.(vaultPath)
    } catch (err) {
      setError(formatGettingStartedCloneError(err))
    } finally {
      setCreatingAction(null)
    }
  }, [onTemplateVaultReady])

  const handleCreateVault = useCallback(async () => {
    const parentPath = await pickFolder('Choose a parent folder for the Getting Started vault')
    if (!parentPath) return
    await createTemplateVault(buildGettingStartedVaultPath(parentPath))
  }, [createTemplateVault])

  const retryCreateVault = useCallback(async () => {
    if (!lastTemplatePath) return
    await createTemplateVault(lastTemplatePath)
  }, [createTemplateVault, lastTemplatePath])

  const handleCreateEmptyVault = useCallback(async () => {
    try {
      setError(null)
      const path = await pickFolder('Choose where to create your vault')
      if (!path) return
      setCreatingAction('empty')
      const vaultPath = await tauriCall<string>('create_empty_vault', { targetPath: path })
      markDismissed()
      setState({ status: 'ready', vaultPath })
      setUserReadyVaultPath(vaultPath)
    } catch (err) {
      setError(typeof err === 'string' ? err : `Failed to create vault: ${err}`)
    } finally {
      setCreatingAction(null)
    }
  }, [])

  const handleOpenFolder = useCallback(async () => {
    try {
      setError(null)
      const path = await pickFolder('Open vault folder')
      if (!path) return
      markDismissed()
      setState({ status: 'ready', vaultPath: path })
      setUserReadyVaultPath(path)
    } catch (err) {
      setError(`Failed to open folder: ${err}`)
    }
  }, [])

  const handleDismiss = useCallback(() => {
    markDismissed()
    setState({ status: 'ready', vaultPath: initialVaultPath })
  }, [initialVaultPath])

  return {
    state,
    creating: creatingAction !== null,
    creatingAction,
    error,
    canRetryTemplate: !!error && !!lastTemplatePath && creatingAction === null,
    handleCreateVault,
    retryCreateVault,
    handleCreateEmptyVault,
    handleOpenFolder,
    handleDismiss,
    userReadyVaultPath,
  }
}
