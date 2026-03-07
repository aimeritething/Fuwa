import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIndexing } from './useIndexing'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(vi.fn()) }))
vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: vi.fn().mockResolvedValue({
    available: true,
    qmd_installed: true,
    collection_exists: true,
    indexed_count: 100,
    embedded_count: 80,
    pending_embed: 0,
  }),
}))

const { mockInvoke } = await import('../mock-tauri') as { mockInvoke: ReturnType<typeof vi.fn> }

describe('useIndexing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockInvoke.mockResolvedValue({
      available: true,
      qmd_installed: true,
      collection_exists: true,
      indexed_count: 100,
      embedded_count: 80,
      pending_embed: 0,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with idle phase', () => {
    const { result } = renderHook(() => useIndexing('/test/vault'))
    expect(result.current.progress.phase).toBe('idle')
  })

  it('auto-dismisses error phase after 15 seconds', async () => {
    const { result } = renderHook(() => useIndexing('/test/vault'))

    // Simulate setting error state via retryIndexing
    mockInvoke.mockRejectedValueOnce(new Error('qmd update failed'))
    await act(async () => { await result.current.retryIndexing() })
    expect(result.current.progress.phase).toBe('error')

    act(() => { vi.advanceTimersByTime(15000) })
    expect(result.current.progress.phase).toBe('idle')
  })

  it('sets unavailable phase for "not installed" errors', async () => {
    const { result } = renderHook(() => useIndexing('/test/vault'))

    mockInvoke.mockRejectedValueOnce(new Error('bun not installed'))
    await act(async () => { await result.current.retryIndexing() })
    expect(result.current.progress.phase).toBe('unavailable')
  })

  it('sets unavailable phase for "not available" errors', async () => {
    const { result } = renderHook(() => useIndexing('/test/vault'))

    mockInvoke.mockRejectedValueOnce(new Error('qmd not available: bun not found'))
    await act(async () => { await result.current.retryIndexing() })
    expect(result.current.progress.phase).toBe('unavailable')
  })

  it('auto-dismisses unavailable phase after 8 seconds', async () => {
    const { result } = renderHook(() => useIndexing('/test/vault'))

    mockInvoke.mockRejectedValueOnce(new Error('bun not installed'))
    await act(async () => { await result.current.retryIndexing() })
    expect(result.current.progress.phase).toBe('unavailable')

    act(() => { vi.advanceTimersByTime(8000) })
    expect(result.current.progress.phase).toBe('idle')
  })

  it('exposes retryIndexing function', () => {
    const { result } = renderHook(() => useIndexing('/test/vault'))
    expect(typeof result.current.retryIndexing).toBe('function')
  })

  it('exposes triggerFullReindex function', () => {
    const { result } = renderHook(() => useIndexing('/test/vault'))
    expect(typeof result.current.triggerFullReindex).toBe('function')
  })

  it('retryIndexing is the same reference as triggerFullReindex', () => {
    const { result } = renderHook(() => useIndexing('/test/vault'))
    expect(result.current.retryIndexing).toBe(result.current.triggerFullReindex)
  })

  it('triggerFullReindex sets scanning phase then completes', async () => {
    const { result } = renderHook(() => useIndexing('/test/vault'))

    await act(async () => { await result.current.triggerFullReindex() })
    // In non-Tauri mode, it goes to 'complete' then auto-dismisses
    expect(result.current.progress.phase).toBe('complete')
  })

  it('triggerFullReindex sets lastIndexedTime on success', async () => {
    const { result } = renderHook(() => useIndexing('/test/vault'))

    expect(result.current.lastIndexedTime).toBeNull()
    await act(async () => { await result.current.triggerFullReindex() })
    expect(result.current.lastIndexedTime).toBeGreaterThan(0)
  })

  it('triggerFullReindex sets error phase on failure', async () => {
    const { result } = renderHook(() => useIndexing('/test/vault'))

    mockInvoke.mockRejectedValueOnce(new Error('indexing failed'))
    await act(async () => { await result.current.triggerFullReindex() })
    expect(result.current.progress.phase).toBe('error')
  })

  it('populates lastIndexedTime from backend metadata on mount', async () => {
    mockInvoke.mockResolvedValue({
      available: true,
      qmd_installed: true,
      collection_exists: true,
      indexed_count: 100,
      embedded_count: 80,
      pending_embed: 0,
      last_indexed_commit: 'abc123',
      last_indexed_at: 1709800000,
    })

    const { result } = renderHook(() => useIndexing('/test/vault'))

    // Wait for the effect to run
    await act(async () => { await vi.advanceTimersByTimeAsync(10) })
    expect(result.current.lastIndexedTime).toBe(1709800000000) // seconds → ms
  })

  it('starts with lastIndexedTime as null', () => {
    const { result } = renderHook(() => useIndexing('/test/vault'))
    expect(result.current.lastIndexedTime).toBeNull()
  })
})
