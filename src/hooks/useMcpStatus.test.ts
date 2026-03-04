import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useMcpStatus } from './useMcpStatus'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: vi.fn(),
}))

const { mockInvoke } = await import('../mock-tauri') as { mockInvoke: ReturnType<typeof vi.fn> }

describe('useMcpStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts in checking state and resolves to installed', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'check_mcp_status') return Promise.resolve('installed')
      if (cmd === 'register_mcp_tools') return Promise.resolve('updated')
      return Promise.resolve(null)
    })

    const onToast = vi.fn()
    const { result } = renderHook(() => useMcpStatus('/vault', onToast))

    expect(result.current.mcpStatus).toBe('checking')

    await waitFor(() => {
      expect(result.current.mcpStatus).toBe('installed')
    })
  })

  it('resolves to not_installed when check returns not_installed', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'check_mcp_status') return Promise.resolve('not_installed')
      if (cmd === 'register_mcp_tools') return Promise.reject(new Error('fail'))
      return Promise.resolve(null)
    })

    const onToast = vi.fn()
    const { result } = renderHook(() => useMcpStatus('/vault', onToast))

    await waitFor(() => {
      expect(result.current.mcpStatus).toBe('not_installed')
    })
  })

  it('resolves to no_claude_cli when check returns no_claude_cli', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'check_mcp_status') return Promise.resolve('no_claude_cli')
      if (cmd === 'register_mcp_tools') return Promise.reject(new Error('no cli'))
      return Promise.resolve(null)
    })

    const onToast = vi.fn()
    const { result } = renderHook(() => useMcpStatus('/vault', onToast))

    await waitFor(() => {
      expect(result.current.mcpStatus).toBe('no_claude_cli')
    })
  })

  it('install action calls register_mcp_tools and updates status', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'check_mcp_status') return Promise.resolve('not_installed')
      if (cmd === 'register_mcp_tools') return Promise.resolve('registered')
      return Promise.resolve(null)
    })

    const onToast = vi.fn()
    const { result } = renderHook(() => useMcpStatus('/vault', onToast))

    await waitFor(() => {
      expect(result.current.mcpStatus).toBe('installed')
    })

    // Reset to test install action directly
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'check_mcp_status') return Promise.resolve('not_installed')
      if (cmd === 'register_mcp_tools') return Promise.resolve('registered')
      return Promise.resolve(null)
    })

    await act(async () => {
      await result.current.installMcp()
    })

    expect(result.current.mcpStatus).toBe('installed')
    expect(onToast).toHaveBeenCalledWith('MCP server installed successfully')
  })

  it('install action shows error toast on failure', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'check_mcp_status') return Promise.resolve('not_installed')
      if (cmd === 'register_mcp_tools') return Promise.reject(new Error('disk full'))
      return Promise.resolve(null)
    })

    const onToast = vi.fn()
    const { result } = renderHook(() => useMcpStatus('/vault', onToast))

    await waitFor(() => {
      expect(result.current.mcpStatus).toBe('not_installed')
    })

    await act(async () => {
      await result.current.installMcp()
    })

    expect(result.current.mcpStatus).toBe('not_installed')
    expect(onToast).toHaveBeenCalledWith(expect.stringContaining('MCP install failed'))
  })

  it('shows toast when registered for the first time', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'check_mcp_status') return Promise.resolve('installed')
      if (cmd === 'register_mcp_tools') return Promise.resolve('registered')
      return Promise.resolve(null)
    })

    const onToast = vi.fn()
    renderHook(() => useMcpStatus('/vault', onToast))

    await waitFor(() => {
      expect(onToast).toHaveBeenCalledWith('Laputa registered as MCP tool for Claude Code')
    })
  })

  it('does not show toast when already registered', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'check_mcp_status') return Promise.resolve('installed')
      if (cmd === 'register_mcp_tools') return Promise.resolve('updated')
      return Promise.resolve(null)
    })

    const onToast = vi.fn()
    renderHook(() => useMcpStatus('/vault', onToast))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('register_mcp_tools', { vaultPath: '/vault' })
    })

    // 'updated' should not trigger a toast
    expect(onToast).not.toHaveBeenCalledWith('Laputa registered as MCP tool for Claude Code')
  })
})
