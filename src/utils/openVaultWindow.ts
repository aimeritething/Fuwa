import { invoke } from '@tauri-apps/api/core'
import type { VaultOption } from '../components/status-bar/types'
import { trackEvent } from '../lib/telemetry'
import { isTauri, mockInvoke } from '../mock-tauri'

interface OpenVaultWindowRequest extends Record<string, unknown> {
  vaultPath: string
  vaultColor: string | null
}

function openVaultWindowCommand(request: OpenVaultWindowRequest): Promise<void> {
  if (isTauri()) {
    return invoke('open_vault_in_new_window', request)
  }
  return mockInvoke('open_vault_in_new_window', request)
}

export async function openVaultInNewWindow(vault: VaultOption): Promise<void> {
  try {
    await openVaultWindowCommand({
      vaultPath: vault.path,
      vaultColor: vault.color ?? null,
    })
    trackEvent('vault_opened_in_separate_window', {
      outcome: 'success',
      has_custom_color: vault.color ? 1 : 0,
    })
  } catch (error) {
    trackEvent('vault_opened_in_separate_window', {
      outcome: 'failed',
      has_custom_color: vault.color ? 1 : 0,
    })
    throw error
  }
}
