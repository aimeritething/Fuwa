import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '@/platform/tauri'

/**
 * The asset protocol starts with nothing allowed, so an Attachment only reaches
 * the editor once its directory is in the scope. Saving or copying an image
 * adds the root on the Rust side; opening a Document that already links to one
 * has to ask, which is what this does.
 *
 * A refusal is not the reader's problem: the Document opens either way, with
 * its images unresolved.
 */
export async function allowVaultAssets(vaultPath: string): Promise<void> {
  if (!isTauri()) return

  try {
    await invoke('sync_vault_asset_scope_for_window', { vaultPath })
  } catch (error) {
    console.warn(`[asset-scope] Could not allow asset access for ${vaultPath}:`, error)
  }
}
