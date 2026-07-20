import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_STORAGE_KEYS } from '../constants/appStorage'
import type { VaultEntry } from '../types'
import { useLastActiveNote } from './useLastActiveNote'

const storage = (() => {
  let values: Record<string, string> = {}
  return {
    clear: () => { values = {} },
    getItem: (key: string) => values[key] ?? null,
    removeItem: (key: string) => { delete values[key] },
    setItem: (key: string, value: string) => { values[key] = value },
  }
})()

const storedEntry = { path: '/vault/topic/dev.md' } as VaultEntry

describe('useLastActiveNote', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    storage.clear()
    vi.stubGlobal('localStorage', storage)
  })

  it('waits for the vault scan before restoring the stored note', async () => {
    storage.setItem(APP_STORAGE_KEYS.lastActiveNotePath, storedEntry.path)
    const openNote = vi.fn(async () => {})
    const { rerender } = renderHook(
      ({ entries, isVaultLoading }) => useLastActiveNote({
        activeTabPath: null,
        enabled: true,
        entries,
        isVaultLoading,
        openNote,
      }),
      { initialProps: { entries: [] as VaultEntry[], isVaultLoading: false } },
    )

    rerender({ entries: [], isVaultLoading: true })
    await act(async () => vi.runAllTimers())
    expect(openNote).not.toHaveBeenCalled()

    rerender({ entries: [storedEntry], isVaultLoading: false })
    await act(async () => vi.runAllTimers())
    expect(openNote).toHaveBeenCalledWith(storedEntry)
  })

  it('clears a stored note that is missing after the vault scan', async () => {
    storage.setItem(APP_STORAGE_KEYS.lastActiveNotePath, '/vault/deleted.md')
    const { rerender } = renderHook(
      ({ isVaultLoading }) => useLastActiveNote({
        activeTabPath: null,
        enabled: true,
        entries: [],
        isVaultLoading,
        openNote: vi.fn(async () => {}),
      }),
      { initialProps: { isVaultLoading: true } },
    )

    rerender({ isVaultLoading: false })
    await act(async () => vi.runAllTimers())
    expect(storage.getItem(APP_STORAGE_KEYS.lastActiveNotePath)).toBeNull()
  })

  it('persists later note selections', async () => {
    const { rerender } = renderHook(
      ({ activeTabPath }) => useLastActiveNote({
        activeTabPath,
        enabled: true,
        entries: [],
        isVaultLoading: false,
        openNote: vi.fn(async () => {}),
      }),
      { initialProps: { activeTabPath: null as string | null } },
    )

    await act(async () => vi.runAllTimers())
    rerender({ activeTabPath: storedEntry.path })
    expect(storage.getItem(APP_STORAGE_KEYS.lastActiveNotePath)).toBe(storedEntry.path)
  })

  it('leaves main-window state untouched when restoration is disabled', async () => {
    storage.setItem(APP_STORAGE_KEYS.lastActiveNotePath, storedEntry.path)

    renderHook(() => useLastActiveNote({
      activeTabPath: '/vault/project/test.md',
      enabled: false,
      entries: [],
      isVaultLoading: false,
      openNote: vi.fn(async () => {}),
    }))
    await act(async () => vi.runAllTimers())

    expect(storage.getItem(APP_STORAGE_KEYS.lastActiveNotePath)).toBe(storedEntry.path)
  })
})
