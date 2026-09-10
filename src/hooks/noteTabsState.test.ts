import { describe, expect, it } from 'vitest'
import type { Tab } from '../types'
import { noteEntryForPath } from '../utils/noteEntry'
import {
  activateAdjacentTab,
  activateTab,
  activateTabAt,
  closeTab,
  EMPTY_NOTE_TABS,
  openTab,
  type NoteTabsState,
} from './noteTabsState'

const tab = (path: string): Tab => ({ entry: noteEntryForPath(path, ''), content: '' })
const paths = (state: NoteTabsState) => state.tabs.map((entry) => entry.entry.path)

function threeOpen(): NoteTabsState {
  return openTab(openTab(openTab(EMPTY_NOTE_TABS, tab('/n/a.md')), tab('/n/b.md')), tab('/n/c.md'))
}

describe('openTab', () => {
  it('appends a fresh Document at the end and activates it', () => {
    const state = threeOpen()

    expect(paths(state)).toEqual(['/n/a.md', '/n/b.md', '/n/c.md'])
    expect(state.activeTabPath).toBe('/n/c.md')
  })

  it('activates the existing Tab instead of adding one when the Document is already open', () => {
    const state = openTab(threeOpen(), tab('/n/a.md'))

    expect(paths(state)).toEqual(['/n/a.md', '/n/b.md', '/n/c.md'])
    expect(state.activeTabPath).toBe('/n/a.md')
  })
})

describe('closeTab', () => {
  it('activates the Tab to the right when the active middle Tab closes', () => {
    const state = closeTab(activateTab(threeOpen(), '/n/b.md'), '/n/b.md')

    expect(paths(state)).toEqual(['/n/a.md', '/n/c.md'])
    expect(state.activeTabPath).toBe('/n/c.md')
  })

  it('activates the Tab to the left when the active last Tab closes', () => {
    const state = closeTab(threeOpen(), '/n/c.md')

    expect(paths(state)).toEqual(['/n/a.md', '/n/b.md'])
    expect(state.activeTabPath).toBe('/n/b.md')
  })

  it('keeps the active Tab when another Tab closes', () => {
    const state = closeTab(activateTab(threeOpen(), '/n/a.md'), '/n/c.md')

    expect(paths(state)).toEqual(['/n/a.md', '/n/b.md'])
    expect(state.activeTabPath).toBe('/n/a.md')
  })

  it('leaves no active Tab when the only Tab closes', () => {
    const state = closeTab(openTab(EMPTY_NOTE_TABS, tab('/n/a.md')), '/n/a.md')

    expect(state).toEqual(EMPTY_NOTE_TABS)
  })

  it('ignores a path that is not open', () => {
    const state = threeOpen()

    expect(closeTab(state, '/n/zzz.md')).toBe(state)
  })
})

describe('positional navigation', () => {
  it('moves to the next and previous Tab positionally, wrapping at the ends', () => {
    const state = threeOpen()

    expect(activateAdjacentTab(state, 1).activeTabPath).toBe('/n/a.md')
    expect(activateAdjacentTab(state, -1).activeTabPath).toBe('/n/b.md')
    expect(activateAdjacentTab(activateTab(state, '/n/a.md'), -1).activeTabPath).toBe('/n/c.md')
  })

  it('jumps to Tab N and ignores an N past the last Tab', () => {
    const state = threeOpen()

    expect(activateTabAt(state, 1).activeTabPath).toBe('/n/b.md')
    expect(activateTabAt(state, 7)).toBe(state)
  })

  it('does nothing with no Tabs open', () => {
    expect(activateAdjacentTab(EMPTY_NOTE_TABS, 1)).toBe(EMPTY_NOTE_TABS)
    expect(activateTabAt(EMPTY_NOTE_TABS, 0)).toBe(EMPTY_NOTE_TABS)
  })
})
