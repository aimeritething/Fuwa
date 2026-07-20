import { useEffect, useMemo, useState } from 'react'
import { useSettings } from '../../hooks/useSettings'
import { resolveEffectiveLocale } from '../../lib/i18n'
import {
  resolveQuickCaptureDestination,
  type QuickCaptureDestination,
  type QuickCaptureVault,
} from '../../lib/quickLauncher'
import { vaultDeepLinkSlug } from '../../utils/deepLinks'
import { loadVaultList } from '../../utils/vaultListStore'
import type { VaultOption } from '../StatusBar'

const LAST_CAPTURE_DESTINATION_KEY = 'tolaria:quick-capture:last-destination'

function storedLastDestination(): QuickCaptureDestination | null {
  try {
    const value = JSON.parse(localStorage.getItem(LAST_CAPTURE_DESTINATION_KEY) ?? 'null') as Partial<QuickCaptureDestination> | null
    return value && typeof value.vaultPath === 'string' && typeof value.folder === 'string'
      ? { vaultPath: value.vaultPath, folder: value.folder }
      : null
  } catch {
    return null
  }
}

export function rememberQuickCaptureDestination(destination: QuickCaptureDestination): void {
  try {
    localStorage.setItem(LAST_CAPTURE_DESTINATION_KEY, JSON.stringify(destination))
  } catch {
    // Saving the note is more important than remembering this convenience.
  }
}

function captureVaults(vaults: readonly VaultOption[]): QuickCaptureVault[] {
  return vaults.map((vault) => ({
    available: vault.available !== false && vault.mounted !== false,
    id: vaultDeepLinkSlug(vault, vaults),
    label: vault.label,
    path: vault.path,
    writable: vault.available !== false && vault.mounted !== false,
  }))
}

export function useQuickLauncherContext() {
  const { settings, loaded: settingsLoaded } = useSettings()
  const [vaults, setVaults] = useState<VaultOption[]>([])
  const [activeVaultPath, setActiveVaultPath] = useState<string | null>(null)
  const [vaultsLoaded, setVaultsLoaded] = useState(false)

  useEffect(() => {
    void loadVaultList({ includeActive: true }).then((list) => {
      setVaults(list.vaults)
      setActiveVaultPath(list.activeVault)
      setVaultsLoaded(true)
    }).catch(() => setVaultsLoaded(true))
  }, [])

  const destinationResolution = useMemo(() => {
    const configured = settings.quick_capture_vault_path
      ? {
          folder: settings.quick_capture_folder ?? '',
          vaultPath: settings.quick_capture_vault_path,
        }
      : null
    return resolveQuickCaptureDestination({
      active: activeVaultPath ? { folder: '', vaultPath: activeVaultPath } : null,
      configured,
      last: storedLastDestination(),
      vaults: captureVaults(vaults),
    })
  }, [activeVaultPath, settings.quick_capture_folder, settings.quick_capture_vault_path, vaults])

  return {
    destinationResolution,
    loaded: settingsLoaded && vaultsLoaded,
    locale: resolveEffectiveLocale(settings.ui_language),
    settings,
    vaults,
  }
}
