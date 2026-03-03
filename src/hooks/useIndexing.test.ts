import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useIndexing } from './useIndexing'

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: vi.fn().mockImplementation((cmd: string) => {
    if (cmd === 'get_index_status') {
      return Promise.resolve({
        available: true,
        qmd_installed: true,
        collection_exists: true,
        indexed_count: 100,
        embedded_count: 80,
        pending_embed: 0,
      })
    }
    if (cmd === 'start_indexing') return Promise.resolve(null)
    if (cmd === 'trigger_incremental_index') return Promise.resolve(null)
    return Promise.resolve(null)
  }),
}))

const { mockInvoke } = await import('../mock-tauri') as { mockInvoke: ReturnType<typeof vi.fn> }

describe('useIndexing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts with idle progress', () => {
    const { result } = renderHook(() => useIndexing('/vault'))
    expect(result.current.progress.phase).toBe('idle')
    expect(result.current.progress.done).toBe(false)
  })

  it('checks index status on mount', async () => {
    renderHook(() => useIndexing('/vault'))
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_index_status', { vaultPath: '/vault' })
    })
  })

  it('does not start indexing when collection exists and no pending embeds', async () => {
    renderHook(() => useIndexing('/vault'))
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_index_status', { vaultPath: '/vault' })
    })
    expect(mockInvoke).not.toHaveBeenCalledWith('start_indexing', expect.anything())
  })

  it('starts indexing when collection is missing', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_index_status') {
        return Promise.resolve({
          available: true,
          qmd_installed: true,
          collection_exists: false,
          indexed_count: 0,
          embedded_count: 0,
          pending_embed: 0,
        })
      }
      return Promise.resolve(null)
    })

    const { result } = renderHook(() => useIndexing('/vault'))
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('start_indexing', { vaultPath: '/vault' })
    })
    expect(result.current.progress.phase).not.toBe('idle')
  })

  it('starts indexing when qmd is not installed', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_index_status') {
        return Promise.resolve({
          available: false,
          qmd_installed: false,
          collection_exists: false,
          indexed_count: 0,
          embedded_count: 0,
          pending_embed: 0,
        })
      }
      return Promise.resolve(null)
    })

    renderHook(() => useIndexing('/vault'))
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('start_indexing', { vaultPath: '/vault' })
    })
  })

  it('starts indexing when pending embeds exist', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_index_status') {
        return Promise.resolve({
          available: true,
          qmd_installed: true,
          collection_exists: true,
          indexed_count: 100,
          embedded_count: 80,
          pending_embed: 20,
        })
      }
      return Promise.resolve(null)
    })

    renderHook(() => useIndexing('/vault'))
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('start_indexing', { vaultPath: '/vault' })
    })
  })

  it('triggerIncrementalIndex calls the command', async () => {
    const { result } = renderHook(() => useIndexing('/vault'))
    await act(async () => {
      await result.current.triggerIncrementalIndex()
    })
    expect(mockInvoke).toHaveBeenCalledWith('trigger_incremental_index', { vaultPath: '/vault' })
  })

  it('handles index status check failure gracefully', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_index_status') return Promise.reject(new Error('network error'))
      return Promise.resolve(null)
    })

    const { result } = renderHook(() => useIndexing('/vault'))
    // Should remain idle — not crash
    await waitFor(() => {
      expect(result.current.progress.phase).toBe('idle')
    })
  })

  it('sets error phase when start_indexing fails', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_index_status') {
        return Promise.resolve({
          available: false,
          qmd_installed: false,
          collection_exists: false,
          indexed_count: 0,
          embedded_count: 0,
          pending_embed: 0,
        })
      }
      if (cmd === 'start_indexing') return Promise.reject(new Error('install failed'))
      return Promise.resolve(null)
    })

    const { result } = renderHook(() => useIndexing('/vault'))
    await waitFor(() => {
      expect(result.current.progress.phase).toBe('error')
    })
    expect(result.current.progress.error).toContain('install failed')
  })
})
