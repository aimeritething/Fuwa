import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VaultConfig } from '../types'
import {
  bindVaultConfigStore,
  getVaultConfig,
  resetVaultConfigStore,
  updateVaultConfigField,
} from './vaultConfigStore'

function vaultConfig(overrides: Partial<VaultConfig> = {}): VaultConfig {
  return {
    zoom: null,
    view_mode: null,
    editor_mode: null,
    note_layout: null,
    tag_colors: null,
    status_colors: null,
    property_display_modes: null,
    inbox: null,
    allNotes: null,
    ...overrides,
  }
}

describe('vaultConfigStore', () => {
  beforeEach(() => {
    resetVaultConfigStore()
  })

  it('fills missing fields from the defaults when binding a config', () => {
    bindVaultConfigStore(vaultConfig({ zoom: 1.25 }), vi.fn())
    expect(getVaultConfig().zoom).toBe(1.25)
    expect(getVaultConfig().view_mode).toBeNull()
  })

  it('persists field updates through the bound save function', () => {
    const save = vi.fn()
    bindVaultConfigStore(vaultConfig(), save)

    updateVaultConfigField('zoom', 1.5)
    expect(getVaultConfig().zoom).toBe(1.5)
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({
      zoom: 1.5,
    }))
  })
})
