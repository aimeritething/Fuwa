import { emitTo } from '@tauri-apps/api/event'
import type { DeepLinkVault } from './deepLinks'
import { buildTolariaDeepLinkForEntry } from './deepLinks'
import { QUICK_LAUNCHER_OPEN_NOTE_EVENT } from '../lib/quickLauncherEvents'
import { isTauri } from '../mock-tauri'

interface OpenQuickLauncherNoteInput {
  absolutePath: string
  vaultPath: string
  vaults: readonly DeepLinkVault[]
}

export async function openQuickLauncherNote({
  absolutePath,
  vaultPath,
  vaults,
}: OpenQuickLauncherNoteInput): Promise<void> {
  const deepLink = buildTolariaDeepLinkForEntry({
    entry: { path: absolutePath },
    vaultPath,
    vaults,
  })
  if (!deepLink.ok) throw new Error(deepLink.error)
  if (!isTauri()) {
    window.__laputaTest = { ...window.__laputaTest, quickLauncherOpenUrl: deepLink.url }
    return
  }
  await emitTo('main', QUICK_LAUNCHER_OPEN_NOTE_EVENT, { url: deepLink.url })
}
