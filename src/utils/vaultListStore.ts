import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { VaultOption } from '../components/StatusBar'

export interface PersistedVaultList {
  vaults: Array<{ label: string; path: string }>
  active_vault: string | null
  hidden_defaults: string[]
}

function tauriCall<T>(command: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : mockInvoke<T>(command, args)
}

async function checkAvailability(v: { label: string; path: string }): Promise<VaultOption> {
  try {
    const exists = await tauriCall<boolean>('check_vault_exists', { path: v.path })
    return { label: v.label, path: v.path, available: exists }
  } catch (error) {
    void error
    return { label: v.label, path: v.path, available: false }
  }
}

export async function loadVaultList(): Promise<{ vaults: VaultOption[]; activeVault: string | null; hiddenDefaults: string[] }> {
  const data = await tauriCall<PersistedVaultList>('load_vault_list', {})
  const persisted = data?.vaults ?? []
  const checked = await Promise.all(persisted.map(checkAvailability))
  return { vaults: checked, activeVault: data?.active_vault ?? null, hiddenDefaults: data?.hidden_defaults ?? [] }
}

export function saveVaultList(vaults: VaultOption[], activeVault: string | null, hiddenDefaults: string[] = []): Promise<void> {
  const list: PersistedVaultList = {
    vaults: vaults.map(v => ({ label: v.label, path: v.path })),
    active_vault: activeVault,
    hidden_defaults: hiddenDefaults,
  }
  return tauriCall('save_vault_list', { list })
}
