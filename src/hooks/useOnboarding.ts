import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
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

const DISMISSED_KEY = 'laputa_welcome_dismissed'

interface PersistedVaultList {
  vaults?: Array<{ label: string; path: string }>
  active_vault?: string | null
  hidden_defaults?: string[]
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

function markDismissed(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, '1')
  } catch {
    // localStorage may be unavailable in some contexts
  }
}

function formatTemplateError(err: unknown): string {
  const message =
    typeof err === 'string'
      ? err
      : err instanceof Error
        ? err.message
        : `${err}`

  if (
    message.includes('already exists and is not empty')
    || message.includes('already exists and is not a directory')
    || message.includes('Failed to create parent directory')
    || message.includes('Target path is required')
  ) {
    return message
  }

  return 'Could not download Getting Started vault. Check your connection and try again.'
}

async function clearMissingActiveVault(missingPath: string): Promise<void> {
  try {
    const list = await tauriCall<PersistedVaultList>('load_vault_list', {})
    if (!list || list.active_vault !== missingPath) return
    await tauriCall('save_vault_list', {
      list: {
        vaults: list.vaults ?? [],
        active_vault: null,
        hidden_defaults: list.hidden_defaults ?? [],
      },
    })
  } catch {
    // Best effort only — onboarding should still proceed
  }
}

export function useOnboarding(initialVaultPath: string) {
  const [state, setState] = useState<OnboardingState>({ status: 'loading' })
  const [creatingAction, setCreatingAction] = useState<CreatingAction>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastTemplatePath, setLastTemplatePath] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const defaultPath = await tauriCall<string>('get_default_vault_path', {})
        const exists = await tauriCall<boolean>('check_vault_exists', { path: initialVaultPath })

        if (cancelled) return

        if (exists) {
          setState({ status: 'ready', vaultPath: initialVaultPath })
        } else {
          await clearMissingActiveVault(initialVaultPath)
          if (cancelled) return
        }

        if (exists) {
          return
        }

        if (wasDismissed()) {
          // User previously dismissed — show vault-missing instead of welcome
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
  }, [initialVaultPath])

  const createTemplateVault = useCallback(async (targetPath: string) => {
    setCreatingAction('template')
    setError(null)
    setLastTemplatePath(targetPath)
    try {
      const vaultPath = await tauriCall<string>('create_getting_started_vault', { targetPath })
      markDismissed()
      setState({ status: 'ready', vaultPath })
    } catch (err) {
      setError(formatTemplateError(err))
    } finally {
      setCreatingAction(null)
    }
  }, [])

  const handleCreateVault = useCallback(async () => {
    const path = await pickFolder('Choose where to clone the Getting Started vault')
    if (!path) return
    await createTemplateVault(path)
  }, [createTemplateVault])

  const retryCreateVault = useCallback(async () => {
    if (!lastTemplatePath) return
    await createTemplateVault(lastTemplatePath)
  }, [createTemplateVault, lastTemplatePath])

  const handleCreateNewVault = useCallback(async () => {
    try {
      setError(null)
      const path = await pickFolder('Choose where to create your vault')
      if (!path) return
      setCreatingAction('empty')
      const vaultPath = await tauriCall<string>('create_empty_vault', { targetPath: path })
      markDismissed()
      setState({ status: 'ready', vaultPath })
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
    handleCreateNewVault,
    handleOpenFolder,
    handleDismiss,
  }
}
