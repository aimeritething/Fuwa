import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInvokeFn = vi.fn()

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (...args: unknown[]) => mockInvokeFn(...args),
}))

vi.mock('../utils/vault-dialog', () => ({
  pickFolder: vi.fn(),
}))

import { useVaultSwitcher, DEFAULT_VAULTS, persistLastVault } from './useVaultSwitcher'
import { pickFolder } from '../utils/vault-dialog'

describe('useVaultSwitcher', () => {
  const onSwitch = vi.fn()
  const onToast = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockInvokeFn.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_last_vault_path') return null
      if (cmd === 'set_last_vault_path') return null
      return null
    })
  })

  it('starts with the default vault path', () => {
    const { result } = renderHook(() => useVaultSwitcher({ onSwitch, onToast }))
    expect(result.current.vaultPath).toBe(DEFAULT_VAULTS[0].path)
  })

  it('loads last vault path from backend on mount', async () => {
    mockInvokeFn.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_last_vault_path') return '/Users/test/MyVault'
      if (cmd === 'set_last_vault_path') return null
      return null
    })

    const { result } = renderHook(() => useVaultSwitcher({ onSwitch, onToast }))

    await waitFor(() => {
      expect(result.current.vaultPath).toBe('/Users/test/MyVault')
    })
  })

  it('falls back to default when no last vault is stored', async () => {
    mockInvokeFn.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_last_vault_path') return null
      return null
    })

    const { result } = renderHook(() => useVaultSwitcher({ onSwitch, onToast }))

    // Wait for the async load to complete
    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith('get_last_vault_path', {})
    })

    expect(result.current.vaultPath).toBe(DEFAULT_VAULTS[0].path)
  })

  it('falls back to default when get_last_vault_path fails', async () => {
    mockInvokeFn.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_last_vault_path') throw new Error('read failed')
      return null
    })

    const { result } = renderHook(() => useVaultSwitcher({ onSwitch, onToast }))

    // Wait for the async load to complete
    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith('get_last_vault_path', {})
    })

    expect(result.current.vaultPath).toBe(DEFAULT_VAULTS[0].path)
  })

  it('persists vault path when switching', async () => {
    const { result } = renderHook(() => useVaultSwitcher({ onSwitch, onToast }))

    act(() => {
      result.current.switchVault('/Users/test/NewVault')
    })

    expect(result.current.vaultPath).toBe('/Users/test/NewVault')
    expect(mockInvokeFn).toHaveBeenCalledWith('set_last_vault_path', { path: '/Users/test/NewVault' })
  })

  it('persists vault path on handleOpenLocalFolder', async () => {
    vi.mocked(pickFolder).mockResolvedValue('/Users/test/OpenedVault')

    const { result } = renderHook(() => useVaultSwitcher({ onSwitch, onToast }))

    await act(async () => {
      await result.current.handleOpenLocalFolder()
    })

    expect(result.current.vaultPath).toBe('/Users/test/OpenedVault')
    expect(mockInvokeFn).toHaveBeenCalledWith('set_last_vault_path', { path: '/Users/test/OpenedVault' })
  })

  it('persists vault path on handleVaultCloned', async () => {
    const { result } = renderHook(() => useVaultSwitcher({ onSwitch, onToast }))

    act(() => {
      result.current.handleVaultCloned('/Users/test/ClonedVault', 'ClonedVault')
    })

    expect(result.current.vaultPath).toBe('/Users/test/ClonedVault')
    expect(mockInvokeFn).toHaveBeenCalledWith('set_last_vault_path', { path: '/Users/test/ClonedVault' })
  })
})

describe('persistLastVault', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvokeFn.mockResolvedValue(null)
  })

  it('calls set_last_vault_path with the given path', () => {
    persistLastVault('/Users/test/Vault')
    expect(mockInvokeFn).toHaveBeenCalledWith('set_last_vault_path', { path: '/Users/test/Vault' })
  })

  it('does not throw when the backend call fails', () => {
    mockInvokeFn.mockRejectedValue(new Error('write failed'))
    expect(() => persistLastVault('/Users/test/Vault')).not.toThrow()
  })
})
