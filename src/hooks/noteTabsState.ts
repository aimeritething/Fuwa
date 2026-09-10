import type { Tab } from '../types'

/**
 * The Tab rules (spec section 5), as pure transitions over the open Tabs in
 * the kernel's `Tab` shape. A Document has at most one Tab; closing the
 * active Tab activates the one to its right, else the left; navigation is
 * positional. New Fuwa code: Tolaria persists neither tabs nor their order.
 */

export interface NoteTabsState {
  /** Tab order. */
  tabs: Tab[]
  activeTabPath: string | null
}

export const EMPTY_NOTE_TABS: NoteTabsState = { tabs: [], activeTabPath: null }

function indexOfPath(tabs: Tab[], path: string | null): number {
  return path === null ? -1 : tabs.findIndex((tab) => tab.entry.path === path)
}

/** Append a freshly read Document and activate it; a Document already open is only activated. */
export function openTab(state: NoteTabsState, tab: Tab): NoteTabsState {
  const path = tab.entry.path
  if (indexOfPath(state.tabs, path) !== -1) return activateTab(state, path)
  return { tabs: [...state.tabs, tab], activeTabPath: path }
}

/** The Tab that takes over when the one at `index` closes: the right neighbour, else the left, else none. */
function successorPath(tabs: Tab[], index: number): string | null {
  const successor = tabs[index + 1] ?? tabs[index - 1]
  return successor ? successor.entry.path : null
}

export function closeTab(state: NoteTabsState, path: string): NoteTabsState {
  const index = indexOfPath(state.tabs, path)
  if (index === -1) return state
  const tabs = state.tabs.filter((tab) => tab.entry.path !== path)
  const activeTabPath = state.activeTabPath === path ? successorPath(state.tabs, index) : state.activeTabPath
  return { tabs, activeTabPath }
}

export function activateTab(state: NoteTabsState, path: string): NoteTabsState {
  if (state.activeTabPath === path || indexOfPath(state.tabs, path) === -1) return state
  return { ...state, activeTabPath: path }
}

/** Jump to the Tab at `index` (0-based); out of range is a no-op. */
export function activateTabAt(state: NoteTabsState, index: number): NoteTabsState {
  const target = state.tabs[index]
  return target ? activateTab(state, target.entry.path) : state
}

/** Previous (-1) or next (+1) Tab positionally, wrapping at either end. */
export function activateAdjacentTab(state: NoteTabsState, direction: 1 | -1): NoteTabsState {
  const count = state.tabs.length
  if (count === 0) return state
  const current = Math.max(indexOfPath(state.tabs, state.activeTabPath), 0)
  return activateTabAt(state, (current + direction + count) % count)
}
