import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TOAST_DURATION_MS, useToast } from './useToast'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it('shows a message and dismisses it on its own', () => {
  const { result } = renderHook(() => useToast())

  act(() => result.current.showToast('docs/adr already has a.md'))
  expect(result.current.toast).toBe('docs/adr already has a.md')

  act(() => { vi.advanceTimersByTime(TOAST_DURATION_MS) })
  expect(result.current.toast).toBeNull()
})

it('restarts the clock when the same message comes round again', () => {
  const { result } = renderHook(() => useToast())

  act(() => result.current.showToast('docs/adr already has a.md'))
  act(() => { vi.advanceTimersByTime(TOAST_DURATION_MS - 100) })
  act(() => result.current.showToast('docs/adr already has a.md'))
  act(() => { vi.advanceTimersByTime(TOAST_DURATION_MS - 100) })

  expect(result.current.toast).toBe('docs/adr already has a.md')
})
