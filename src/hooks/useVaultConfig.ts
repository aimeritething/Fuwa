import { useEffect, useCallback, useSyncExternalStore } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { VaultConfig } from '../types'
import { initStatusColors } from '../utils/statusStyles'
import { initTagColors } from '../utils/tagStyles'
import { initDisplayModeOverrides } from '../utils/propertyTypes'
import {
  getVaultConfig,
  bindVaultConfigStore,
  resetVaultConfigStore,
  updateVaultConfigField,
  subscribeVaultConfig,
} from '../utils/vaultConfigStore'
import { migrateLocalStorageToVaultConfig } from '../utils/configMigration'

function tauriCall<T>(command: string, tauriArgs: Record<string, unknown>, mockArgs?: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, tauriArgs) : mockInvoke<T>(command, mockArgs ?? tauriArgs)
}

function applyToModules(c: VaultConfig): void {
  initStatusColors(c.status_colors ?? {})
  initTagColors(c.tag_colors ?? {})
  initDisplayModeOverrides(c.property_display_modes ?? {})
}

function persistConfig(vaultPath: string, config: VaultConfig): void {
  tauriCall<void>('save_vault_config', { vaultPath, config })
    .catch((err) => console.warn('Failed to save vault config:', err))
}

export function useVaultConfig(vaultPath: string) {
  const config = useSyncExternalStore(subscribeVaultConfig, getVaultConfig)

  useEffect(() => {
    resetVaultConfigStore()

    tauriCall<VaultConfig>('get_vault_config', { vaultPath })
      .then((loaded) => {
        const migrated = migrateLocalStorageToVaultConfig(loaded)
        const needsSave = migrated !== loaded
        bindVaultConfigStore(migrated, (c) => persistConfig(vaultPath, c))
        applyToModules(migrated)
        if (needsSave) persistConfig(vaultPath, migrated)
      })
      .catch((err) => {
        console.warn('Failed to load vault config:', err)
        const migrated = migrateLocalStorageToVaultConfig(null)
        bindVaultConfigStore(migrated, (c) => persistConfig(vaultPath, c))
        applyToModules(migrated)
        if (migrated.zoom !== null || migrated.tag_colors !== null || migrated.status_colors !== null) {
          persistConfig(vaultPath, migrated)
        }
      })

    return () => resetVaultConfigStore()
  }, [vaultPath])

  const update = useCallback(<K extends keyof VaultConfig>(key: K, value: VaultConfig[K]) => {
    updateVaultConfigField(key, value)
    // Re-apply to modules for color/property changes
    const next = getVaultConfig()
    applyToModules(next)
  }, [])

  return { config, updateConfig: update }
}
