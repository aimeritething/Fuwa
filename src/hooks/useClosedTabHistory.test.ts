import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useClosedTabHistory } from './useClosedTabHistory'

describe('useClosedTabHistory', () => {
  it('starts with empty history', () => {
    const { result } = renderHook(() => useClosedTabHistory())
    expect(result.current.canReopen).toBe(false)
  })

  it('records a closed tab and allows reopening', () => {
    const { result } = renderHook(() => useClosedTabHistory())

    act(() => { result.current.push('/vault/a.md', 0) })

    expect(result.current.canReopen).toBe(true)
    const entry = result.current.pop()
    expect(entry).toEqual({ path: '/vault/a.md', index: 0 })
    expect(result.current.canReopen).toBe(false)
  })

  it('pops in LIFO order', () => {
    const { result } = renderHook(() => useClosedTabHistory())

    act(() => {
      result.current.push('/vault/a.md', 0)
      result.current.push('/vault/b.md', 1)
      result.current.push('/vault/c.md', 2)
    })

    expect(result.current.pop()).toEqual({ path: '/vault/c.md', index: 2 })
    expect(result.current.pop()).toEqual({ path: '/vault/b.md', index: 1 })
    expect(result.current.pop()).toEqual({ path: '/vault/a.md', index: 0 })
    expect(result.current.pop()).toBeNull()
  })

  it('returns null when popping empty history', () => {
    const { result } = renderHook(() => useClosedTabHistory())
    expect(result.current.pop()).toBeNull()
  })

  it('caps history at 20 entries', () => {
    const { result } = renderHook(() => useClosedTabHistory())

    act(() => {
      for (let i = 0; i < 25; i++) {
        result.current.push(`/vault/${i}.md`, i)
      }
    })

    // Should only have last 20 entries (5-24)
    const first = result.current.pop()
    expect(first).toEqual({ path: '/vault/24.md', index: 24 })

    // Pop remaining 19
    for (let i = 0; i < 19; i++) {
      result.current.pop()
    }
    expect(result.current.pop()).toBeNull()
  })

  it('deduplicates: closing same path twice keeps only latest entry', () => {
    const { result } = renderHook(() => useClosedTabHistory())

    act(() => {
      result.current.push('/vault/a.md', 0)
      result.current.push('/vault/b.md', 1)
      result.current.push('/vault/a.md', 2) // close a.md again at different index
    })

    // a.md should only appear once (the latest), at the top
    expect(result.current.pop()).toEqual({ path: '/vault/a.md', index: 2 })
    expect(result.current.pop()).toEqual({ path: '/vault/b.md', index: 1 })
    expect(result.current.pop()).toBeNull()
  })

  it('clear resets the history', () => {
    const { result } = renderHook(() => useClosedTabHistory())

    act(() => {
      result.current.push('/vault/a.md', 0)
      result.current.push('/vault/b.md', 1)
    })

    act(() => { result.current.clear() })

    expect(result.current.canReopen).toBe(false)
    expect(result.current.pop()).toBeNull()
  })
})
