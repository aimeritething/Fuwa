import { beforeEach, describe, expect, it, vi } from 'vitest'
import { allowVaultAssets } from './vault-asset-scope'

let tauriMode = true

const runtime = vi.hoisted(() => ({
  invoke: vi.fn<(cmd: string, args?: Record<string, unknown>) => Promise<unknown>>(),
}))

vi.mock('@/platform/tauri', () => ({
  isTauri: () => tauriMode,
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) => runtime.invoke(cmd, args),
}))

describe('allowVaultAssets', () => {
  beforeEach(() => {
    tauriMode = true
    runtime.invoke.mockReset()
    runtime.invoke.mockResolvedValue(undefined)
  })

  it('puts a boundary root into the asset scope so its Attachments can be shown', async () => {
    await allowVaultAssets('/Users/plumo/Notes')

    expect(runtime.invoke).toHaveBeenCalledWith('sync_vault_asset_scope_for_window', {
      vaultPath: '/Users/plumo/Notes',
    })
  })

  it('carries on when the boundary refuses the root', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    runtime.invoke.mockRejectedValue('Path must stay inside the active vault')

    try {
      await expect(allowVaultAssets('/etc')).resolves.toBeUndefined()
      expect(warn).toHaveBeenCalledWith(
        '[asset-scope] Could not allow asset access for /etc:',
        'Path must stay inside the active vault',
      )
    } finally {
      warn.mockRestore()
    }
  })

  it('has nothing to allow outside Tauri, where there is no asset protocol', async () => {
    tauriMode = false

    await allowVaultAssets('/Users/plumo/Notes')

    expect(runtime.invoke).not.toHaveBeenCalled()
  })
})
