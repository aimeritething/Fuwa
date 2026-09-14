import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useCommandMenu } from './use-command-menu'

describe('useCommandMenu', () => {
  it('starts closed, and ⌘K opens the Command Menu', () => {
    const { result } = renderHook(() => useCommandMenu())
    expect(result.current).toMatchObject({ open: false })

    act(() => result.current.openCommands())
    expect(result.current).toMatchObject({ open: true, mode: 'commands' })
  })

  it('⌘P opens Quick Open, and the same chord again closes what it opened', () => {
    const { result } = renderHook(() => useCommandMenu())
    act(() => result.current.openFiles())
    expect(result.current).toMatchObject({ open: true, mode: 'files' })

    act(() => result.current.openFiles())
    expect(result.current.open).toBe(false)
  })

  it('the other chord switches the mode of an open palette in place', () => {
    const { result } = renderHook(() => useCommandMenu())
    act(() => result.current.openFiles())
    act(() => result.current.openCommands())
    expect(result.current).toMatchObject({ open: true, mode: 'commands' })

    act(() => result.current.openFiles())
    expect(result.current).toMatchObject({ open: true, mode: 'files' })
  })

  it('close closes, and is a no-op on a closed palette', () => {
    const { result } = renderHook(() => useCommandMenu())
    const before = result.current
    act(() => result.current.close())
    expect(result.current.open).toBe(false)
    expect(result.current.openCommands).toBe(before.openCommands)

    act(() => result.current.openCommands())
    act(() => result.current.close())
    expect(result.current.open).toBe(false)
  })
})
