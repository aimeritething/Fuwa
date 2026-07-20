import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadVaultList, saveVaultList, type PersistedVaultList } from './vaultListStore'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: mocks.invoke,
}))

describe('vaultListStore global search preferences', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads and saves each vault search opt-in', async () => {
    const persisted: PersistedVaultList = {
      active_vault: '/vault-a',
      hidden_defaults: [],
      vaults: [
        { label: 'Vault A', path: '/vault-a', searchEnabled: false },
        { label: 'Vault B', path: '/vault-b' },
      ],
    }
    mocks.invoke.mockImplementation((command: string) => {
      if (command === 'load_vault_list') return Promise.resolve(persisted)
      if (command === 'check_vault_exists') return Promise.resolve(true)
      return Promise.resolve(undefined)
    })

    const loaded = await loadVaultList()
    expect(loaded.vaults.map((vault) => vault.searchEnabled)).toEqual([false, true])
    await saveVaultList(loaded.vaults, loaded.activeVault)

    expect(mocks.invoke).toHaveBeenLastCalledWith('save_vault_list', {
      list: expect.objectContaining({
        vaults: [
          expect.objectContaining({ path: '/vault-a', searchEnabled: false }),
          expect.objectContaining({ path: '/vault-b', searchEnabled: true }),
        ],
      }),
    })
  })

  it('keeps an available active vault when legacy persistence omitted it from the registry', async () => {
    const persisted: PersistedVaultList = {
      active_vault: '/vault-active',
      hidden_defaults: [],
      vaults: [{ label: 'Saved vault', path: '/vault-saved' }],
    }
    mocks.invoke.mockImplementation((command: string, args: { path?: string }) => {
      if (command === 'load_vault_list') return Promise.resolve(persisted)
      if (command === 'check_vault_exists') return Promise.resolve(args.path === '/vault-active')
      return Promise.resolve(undefined)
    })

    const loaded = await loadVaultList({ includeActive: true })

    expect(loaded.vaults).toContainEqual(expect.objectContaining({
      available: true,
      label: 'vault-active',
      path: '/vault-active',
      searchEnabled: true,
    }))
  })
})
