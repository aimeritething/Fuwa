import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { VaultEntry, SidebarSelection } from '../types'
import { useKeyboardNavigation } from './useKeyboardNavigation'

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
}))

const makeEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  path: '/vault/note/test.md',
  filename: 'test.md',
  title: 'Test Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: 'Active',
  archived: false,
  trashed: false,
  trashedAt: null,
  modifiedAt: 1700000000,
  createdAt: 1700000000,
  fileSize: 100,
  snippet: '',
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  template: null, sort: null,
  outgoingLinks: [],
  properties: {},
  ...overrides,
})

describe('useKeyboardNavigation', () => {
  const onReplaceActiveTab = vi.fn()
  const onSelectNote = vi.fn()

  const entries = [
    makeEntry({ path: '/vault/a.md', title: 'A', modifiedAt: 1700000003 }),
    makeEntry({ path: '/vault/b.md', title: 'B', modifiedAt: 1700000002 }),
    makeEntry({ path: '/vault/c.md', title: 'C', modifiedAt: 1700000001 }),
  ]

  const selection: SidebarSelection = { kind: 'filter', filter: 'all' }
  let addedListeners: { type: string; handler: EventListenerOrEventListenerObject }[] = []

  beforeEach(() => {
    vi.clearAllMocks()
    addedListeners = []
    // Track added listeners for cleanup verification
    const origAdd = window.addEventListener
    const origRemove = window.removeEventListener
    vi.spyOn(window, 'addEventListener').mockImplementation((type: string, handler: EventListenerOrEventListenerObject, opts?: boolean | AddEventListenerOptions) => {
      addedListeners.push({ type, handler })
      origAdd.call(window, type, handler, opts)
    })
    vi.spyOn(window, 'removeEventListener').mockImplementation((type: string, handler: EventListenerOrEventListenerObject, opts?: boolean | EventListenerOptions) => {
      origRemove.call(window, type, handler, opts)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registers keydown listener on mount', () => {
    renderHook(() =>
      useKeyboardNavigation({
        activeTabPath: '/vault/a.md', entries, selection,
        onReplaceActiveTab, onSelectNote,
      })
    )

    expect(addedListeners.some(l => l.type === 'keydown')).toBe(true)
  })

  it('navigates to next note on Cmd+Alt+ArrowDown', () => {
    renderHook(() =>
      useKeyboardNavigation({
        activeTabPath: '/vault/a.md', entries, selection,
        onReplaceActiveTab, onSelectNote,
      })
    )

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowDown', metaKey: true, altKey: true, bubbles: true,
      }))
    })

    expect(onReplaceActiveTab).toHaveBeenCalled()
  })

  it('navigates to previous note on Cmd+Alt+ArrowUp', () => {
    renderHook(() =>
      useKeyboardNavigation({
        activeTabPath: '/vault/b.md', entries, selection,
        onReplaceActiveTab, onSelectNote,
      })
    )

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowUp', metaKey: true, altKey: true, bubbles: true,
      }))
    })

    expect(onReplaceActiveTab).toHaveBeenCalled()
  })

  it('selects first note when no active tab', () => {
    renderHook(() =>
      useKeyboardNavigation({
        activeTabPath: null, entries, selection,
        onReplaceActiveTab, onSelectNote,
      })
    )

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowDown', metaKey: true, altKey: true, bubbles: true,
      }))
    })

    expect(onSelectNote).toHaveBeenCalled()
  })

  it('does nothing without modifier keys', () => {
    renderHook(() =>
      useKeyboardNavigation({
        activeTabPath: '/vault/a.md', entries, selection,
        onReplaceActiveTab, onSelectNote,
      })
    )

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowRight', bubbles: true,
      }))
    })

    expect(onReplaceActiveTab).not.toHaveBeenCalled()
    expect(onSelectNote).not.toHaveBeenCalled()
  })
})
