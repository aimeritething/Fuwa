import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useVaultSwitcher, DEFAULT_VAULTS } from './useVaultSwitcher'
import type { PersistedVaultList } from './useVaultSwitcher'

let mockVaultListStore: PersistedVaultList = { vaults: [], active_vault: null, hidden_defaults: [] }

const mockInvokeFn = vi.fn((cmd: string, args?: Record<string, unknown>): Promise<unknown> => {
  if (cmd === 'load_vault_list') return Promise.resolve({ ...mockVaultListStore })
  if (cmd === 'save_vault_list') {
    mockVaultListStore = { ...(args as { list: PersistedVaultList }).list }
    return Promise.resolve(null)
  }
  if (cmd === 'check_vault_exists') return Promise.resolve(true)
  return Promise.resolve(null)
})

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => mockInvokeFn(cmd, args),
}))

vi.mock('../utils/vault-dialog', () => ({
  pickFolder: vi.fn(),
}))

describe('useVaultSwitcher', () => {
  const onSwitch = vi.fn()
  const onToast = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    mockVaultListStore = { vaults: [], active_vault: null, hidden_defaults: [] }
    // Re-set default implementation after resetAllMocks
    mockInvokeFn.mockImplementation((cmd: string, args?: Record<string, unknown>): Promise<unknown> => {
      if (cmd === 'load_vault_list') return Promise.resolve({ ...mockVaultListStore })
      if (cmd === 'save_vault_list') {
        mockVaultListStore = { ...(args as { list: PersistedVaultList }).list }
        return Promise.resolve(null)
      }
      if (cmd === 'check_vault_exists') return Promise.resolve(true)
      return Promise.resolve(null)
    })
  })

  it('starts with default vaults', async () => {
    const { result } = renderHook(() => useVaultSwitcher({ onSwitch, onToast }))
    expect(result.current.allVaults).toEqual(DEFAULT_VAULTS)
    expect(result.current.vaultPath).toBe(DEFAULT_VAULTS[0].path)
    await waitFor(() => { expect(result.current.loaded).toBe(true) })
  })

  it('loads persisted vaults on mount', async () => {
    mockVaultListStore = {
      vaults: [{ label: 'My Vault', path: '/Users/luca/Laputa' }],
      active_vault: '/Users/luca/Laputa',
    }

    const { result } = renderHook(() => useVaultSwitcher({ onSwitch, onToast }))

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    expect(result.current.allVaults).toHaveLength(2) // default + persisted
    expect(result.current.allVaults[1].label).toBe('My Vault')
    expect(result.current.allVaults[1].path).toBe('/Users/luca/Laputa')
    expect(result.current.allVaults[1].available).toBe(true)
    expect(result.current.vaultPath).toBe('/Users/luca/Laputa')
    expect(mockInvokeFn).toHaveBeenCalledWith('load_vault_list', {})
  })

  it('marks unavailable vaults when check_vault_exists returns false', async () => {
    mockVaultListStore = {
      vaults: [{ label: 'External', path: '/Volumes/USB/vault' }],
      active_vault: null,
    }
    mockInvokeFn.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === 'load_vault_list') return Promise.resolve({ ...mockVaultListStore })
      if (cmd === 'save_vault_list') {
        mockVaultListStore = { ...(args as { list: PersistedVaultList }).list }
        return Promise.resolve(null)
      }
      if (cmd === 'check_vault_exists') return Promise.resolve(false)
      return Promise.resolve(null)
    })

    const { result } = renderHook(() => useVaultSwitcher({ onSwitch, onToast }))

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    expect(result.current.allVaults[1].available).toBe(false)
    expect(result.current.allVaults[1].label).toBe('External')
  })

  it('persists vault list when adding a vault via handleVaultCloned', async () => {
    const { result } = renderHook(() => useVaultSwitcher({ onSwitch, onToast }))

    await waitFor(() => { expect(result.current.loaded).toBe(true) })

    act(() => {
      result.current.handleVaultCloned('/cloned/vault', 'Cloned')
    })

    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith('save_vault_list', expect.objectContaining({
        list: expect.objectContaining({
          vaults: expect.arrayContaining([
            expect.objectContaining({ label: 'Cloned', path: '/cloned/vault' }),
          ]),
        }),
      }))
    })
  })

  it('persists active vault when switching', async () => {
    mockVaultListStore = {
      vaults: [{ label: 'Work', path: '/work/vault' }],
      active_vault: null,
    }

    const { result } = renderHook(() => useVaultSwitcher({ onSwitch, onToast }))

    await waitFor(() => { expect(result.current.loaded).toBe(true) })

    act(() => {
      result.current.switchVault('/work/vault')
    })

    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith('save_vault_list', expect.objectContaining({
        list: expect.objectContaining({
          active_vault: '/work/vault',
        }),
      }))
    })
    expect(onSwitch).toHaveBeenCalled()
  })

  it('handles load error gracefully', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockInvokeFn.mockImplementation((cmd: string) => {
      if (cmd === 'load_vault_list') return Promise.reject(new Error('disk error'))
      return Promise.resolve(null)
    })

    const { result } = renderHook(() => useVaultSwitcher({ onSwitch, onToast }))

    await waitFor(() => { expect(result.current.loaded).toBe(true) })

    // Should fall back to defaults
    expect(result.current.allVaults).toEqual(DEFAULT_VAULTS)
    warnSpy.mockRestore()
  })

  it('does not duplicate vaults with same path', async () => {
    const { result } = renderHook(() => useVaultSwitcher({ onSwitch, onToast }))
    await waitFor(() => { expect(result.current.loaded).toBe(true) })

    act(() => {
      result.current.handleVaultCloned('/some/vault', 'First')
    })
    act(() => {
      result.current.handleVaultCloned('/some/vault', 'Duplicate')
    })

    const extras = result.current.allVaults.filter(v => v.path === '/some/vault')
    expect(extras).toHaveLength(1)
  })

  it('opens local folder and persists', async () => {
    const { pickFolder } = await import('../utils/vault-dialog')
    vi.mocked(pickFolder).mockResolvedValue('/Users/luca/MyVault')

    const { result } = renderHook(() => useVaultSwitcher({ onSwitch, onToast }))
    await waitFor(() => { expect(result.current.loaded).toBe(true) })

    await act(async () => {
      await result.current.handleOpenLocalFolder()
    })

    expect(result.current.allVaults.some(v => v.path === '/Users/luca/MyVault')).toBe(true)
    expect(onToast).toHaveBeenCalledWith('Vault "MyVault" opened')
  })

  describe('removeVault', () => {
    it('removes an extra vault from the list', async () => {
      mockVaultListStore = {
        vaults: [{ label: 'Work', path: '/work/vault' }],
        active_vault: null,
        hidden_defaults: [],
      }

      const { result } = renderHook(() => useVaultSwitcher({ onSwitch, onToast }))
      await waitFor(() => { expect(result.current.loaded).toBe(true) })

      expect(result.current.allVaults).toHaveLength(2) // default + Work

      act(() => {
        result.current.removeVault('/work/vault')
      })

      expect(result.current.allVaults.some(v => v.path === '/work/vault')).toBe(false)
      expect(onToast).toHaveBeenCalledWith('Vault "Work" removed from list')
    })

    it('hides a default vault instead of deleting it', async () => {
      const { result } = renderHook(() => useVaultSwitcher({ onSwitch, onToast }))
      await waitFor(() => { expect(result.current.loaded).toBe(true) })

      const defaultPath = DEFAULT_VAULTS[0].path
      expect(result.current.allVaults.some(v => v.path === defaultPath)).toBe(true)

      act(() => {
        result.current.removeVault(defaultPath)
      })

      expect(result.current.allVaults.some(v => v.path === defaultPath)).toBe(false)
      expect(result.current.isGettingStartedHidden).toBe(true)
    })

    it('switches to another vault when removing the active vault', async () => {
      mockVaultListStore = {
        vaults: [{ label: 'Work', path: '/work/vault' }],
        active_vault: '/work/vault',
        hidden_defaults: [],
      }

      const { result } = renderHook(() => useVaultSwitcher({ onSwitch, onToast }))
      await waitFor(() => { expect(result.current.loaded).toBe(true) })

      expect(result.current.vaultPath).toBe('/work/vault')

      act(() => {
        result.current.removeVault('/work/vault')
      })

      // Should switch to the default vault
      expect(result.current.vaultPath).toBe(DEFAULT_VAULTS[0].path)
    })

    it('shows toast when vault is removed', async () => {
      mockVaultListStore = {
        vaults: [{ label: 'Docs', path: '/docs/vault' }],
        active_vault: null,
        hidden_defaults: [],
      }

      const { result } = renderHook(() => useVaultSwitcher({ onSwitch, onToast }))
      await waitFor(() => { expect(result.current.loaded).toBe(true) })

      act(() => {
        result.current.removeVault('/docs/vault')
      })

      expect(onToast).toHaveBeenCalledWith('Vault "Docs" removed from list')
    })

    it('persists hidden_defaults when removing a default vault', async () => {
      const { result } = renderHook(() => useVaultSwitcher({ onSwitch, onToast }))
      await waitFor(() => { expect(result.current.loaded).toBe(true) })

      // Add another vault first so we're not removing the last one
      act(() => {
        result.current.handleVaultCloned('/other/vault', 'Other')
      })

      act(() => {
        result.current.removeVault(DEFAULT_VAULTS[0].path)
      })

      await waitFor(() => {
        expect(mockInvokeFn).toHaveBeenCalledWith('save_vault_list', expect.objectContaining({
          list: expect.objectContaining({
            hidden_defaults: [DEFAULT_VAULTS[0].path],
          }),
        }))
      })
    })
  })

  describe('restoreGettingStarted', () => {
    it('un-hides the Getting Started vault', async () => {
      mockVaultListStore = {
        vaults: [{ label: 'Work', path: '/work/vault' }],
        active_vault: '/work/vault',
        hidden_defaults: [DEFAULT_VAULTS[0].path],
      }

      const { result } = renderHook(() => useVaultSwitcher({ onSwitch, onToast }))
      await waitFor(() => { expect(result.current.loaded).toBe(true) })

      expect(result.current.isGettingStartedHidden).toBe(true)

      await act(async () => {
        await result.current.restoreGettingStarted()
      })

      expect(result.current.isGettingStartedHidden).toBe(false)
      expect(result.current.allVaults.some(v => v.path === DEFAULT_VAULTS[0].path)).toBe(true)
    })

    it('switches to the Getting Started vault after restoring', async () => {
      mockVaultListStore = {
        vaults: [{ label: 'Work', path: '/work/vault' }],
        active_vault: '/work/vault',
        hidden_defaults: [DEFAULT_VAULTS[0].path],
      }

      const { result } = renderHook(() => useVaultSwitcher({ onSwitch, onToast }))
      await waitFor(() => { expect(result.current.loaded).toBe(true) })

      await act(async () => {
        await result.current.restoreGettingStarted()
      })

      expect(result.current.vaultPath).toBe(DEFAULT_VAULTS[0].path)
      expect(onToast).toHaveBeenCalledWith('Getting Started vault restored')
    })

    it('attempts to create vault on disk if it does not exist', async () => {
      mockVaultListStore = {
        vaults: [{ label: 'Work', path: '/work/vault' }],
        active_vault: '/work/vault',
        hidden_defaults: [DEFAULT_VAULTS[0].path],
      }
      mockInvokeFn.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
        if (cmd === 'load_vault_list') return Promise.resolve({ ...mockVaultListStore })
        if (cmd === 'save_vault_list') {
          mockVaultListStore = { ...(args as { list: PersistedVaultList }).list }
          return Promise.resolve(null)
        }
        if (cmd === 'check_vault_exists') return Promise.resolve(false)
        if (cmd === 'create_getting_started_vault') return Promise.resolve(DEFAULT_VAULTS[0].path)
        return Promise.resolve(null)
      })

      const { result } = renderHook(() => useVaultSwitcher({ onSwitch, onToast }))
      await waitFor(() => { expect(result.current.loaded).toBe(true) })

      await act(async () => {
        await result.current.restoreGettingStarted()
      })

      expect(mockInvokeFn).toHaveBeenCalledWith('check_vault_exists', { path: DEFAULT_VAULTS[0].path })
      expect(mockInvokeFn).toHaveBeenCalledWith('create_getting_started_vault', { targetPath: DEFAULT_VAULTS[0].path })
    })
  })

  describe('isGettingStartedHidden', () => {
    it('is false by default', async () => {
      const { result } = renderHook(() => useVaultSwitcher({ onSwitch, onToast }))
      await waitFor(() => { expect(result.current.loaded).toBe(true) })
      expect(result.current.isGettingStartedHidden).toBe(false)
    })

    it('is true when Getting Started path is in hidden_defaults', async () => {
      mockVaultListStore = {
        vaults: [],
        active_vault: null,
        hidden_defaults: [DEFAULT_VAULTS[0].path],
      }

      const { result } = renderHook(() => useVaultSwitcher({ onSwitch, onToast }))
      await waitFor(() => { expect(result.current.loaded).toBe(true) })
      expect(result.current.isGettingStartedHidden).toBe(true)
    })
  })
})
