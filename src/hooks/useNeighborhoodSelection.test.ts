import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MutableRefObject } from 'react'
import type { SidebarSelection, VaultEntry } from '../types'
import {
  useNeighborhoodEntry,
  useNeighborhoodEscape,
} from './useNeighborhoodSelection'

function buildEntry(path: string, title: string): VaultEntry {
  return {
    path,
    filename: `${title.toLowerCase()}.md`,
    title,
    isA: 'Note',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    archived: false,
    owner: null,
    cadence: null,
    modifiedAt: 1,
    createdAt: null,
    fileSize: 1,
    snippet: '',
    wordCount: 1,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    sort: null,
    view: null,
    visible: true,
    organized: false,
    favorite: false,
    favoriteIndex: null,
    listPropertiesDisplay: [],
    outgoingLinks: [],
    properties: {},
    hasH1: true,
    fileKind: 'markdown',
  }
}

function ref<T>(current: T): MutableRefObject<T> {
  return { current }
}

const inboxSelection: SidebarSelection = { kind: 'filter', filter: 'inbox' }
const alphaSelection: SidebarSelection = { kind: 'entity', entry: buildEntry('/vault/alpha.md', 'Alpha') }
const betaSelection: SidebarSelection = { kind: 'entity', entry: buildEntry('/vault/beta.md', 'Beta') }

describe('useNeighborhoodEntry', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 0
    })
    document.body.innerHTML = '<div data-testid="note-list-container" tabindex="-1"></div>'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('toggles the repeated active neighborhood action back to all notes', () => {
    const selectionRef = ref(alphaSelection)
    const historyRef = ref<SidebarSelection[]>([inboxSelection])
    const setSelection = vi.fn((selection: SidebarSelection) => {
      selectionRef.current = selection
    })
    const { result } = renderHook(() => useNeighborhoodEntry({
      neighborhoodHistoryRef: historyRef,
      selectionRef,
      setSelection,
    }))

    act(() => result.current(alphaSelection.entry))

    expect(setSelection).toHaveBeenCalledWith({ kind: 'filter', filter: 'all' })
    expect(historyRef.current).toEqual([inboxSelection])
    expect(document.activeElement).toBe(document.querySelector('[data-testid="note-list-container"]'))
  })

  it('switches between neighborhoods without collapsing to all notes', () => {
    const selectionRef = ref(alphaSelection)
    const historyRef = ref<SidebarSelection[]>([inboxSelection])
    const setSelection = vi.fn()
    const { result } = renderHook(() => useNeighborhoodEntry({
      neighborhoodHistoryRef: historyRef,
      selectionRef,
      setSelection,
    }))

    act(() => result.current(betaSelection.entry))

    expect(setSelection).toHaveBeenCalledWith(betaSelection, { preserveNeighborhoodHistory: true })
    expect(historyRef.current).toEqual([inboxSelection, alphaSelection])
  })
})

describe('useNeighborhoodEscape', () => {
  it('routes Escape to neighborhood history when focus is already outside editable controls', () => {
    const onBack = vi.fn(() => true)
    renderHook(() => useNeighborhoodEscape({
      onBack,
      selectionRef: ref(alphaSelection),
      shouldBlockNeighborhoodEscape: false,
    }))

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    window.dispatchEvent(event)

    expect(onBack).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(true)
  })
})
