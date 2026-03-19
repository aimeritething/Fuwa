import { describe, it, expect, vi } from 'vitest'
import { routeNoteClick, type ClickActions } from './noteListUtils'
import type { VaultEntry } from '../../types'

function makeEntry(path = '/test.md'): VaultEntry {
  return {
    path, filename: 'test.md', title: 'Test', isA: null,
    aliases: [], belongsTo: [], relatedTo: [], status: null,
    archived: false, trashed: false, trashedAt: null,
    modifiedAt: null, createdAt: null, fileSize: 0,
    snippet: '', wordCount: 0, relationships: {},
    icon: null, color: null, order: null, sidebarLabel: null,
    template: null, sort: null, view: null, visible: null,
    outgoingLinks: [], properties: {},
  }
}

function makeActions(): ClickActions {
  return {
    onReplace: vi.fn(),
    onSelect: vi.fn(),
    onOpenInNewWindow: vi.fn(),
    multiSelect: {
      selectRange: vi.fn(),
      clear: vi.fn(),
      setAnchor: vi.fn(),
    },
  }
}

function makeMouseEvent(overrides: Partial<React.MouseEvent> = {}): React.MouseEvent {
  return { metaKey: false, ctrlKey: false, shiftKey: false, ...overrides } as React.MouseEvent
}

describe('routeNoteClick', () => {
  it('plain click replaces active tab', () => {
    const entry = makeEntry()
    const actions = makeActions()
    routeNoteClick(entry, makeMouseEvent(), actions)
    expect(actions.onReplace).toHaveBeenCalledWith(entry)
    expect(actions.multiSelect.clear).toHaveBeenCalled()
    expect(actions.multiSelect.setAnchor).toHaveBeenCalledWith(entry.path)
  })

  it('Cmd+click opens as new tab', () => {
    const entry = makeEntry()
    const actions = makeActions()
    routeNoteClick(entry, makeMouseEvent({ metaKey: true }), actions)
    expect(actions.onSelect).toHaveBeenCalledWith(entry)
    expect(actions.multiSelect.clear).toHaveBeenCalled()
  })

  it('Shift+click selects range', () => {
    const entry = makeEntry()
    const actions = makeActions()
    routeNoteClick(entry, makeMouseEvent({ shiftKey: true }), actions)
    expect(actions.multiSelect.selectRange).toHaveBeenCalledWith(entry.path)
  })

  it('Cmd+Shift+click opens in new window', () => {
    const entry = makeEntry()
    const actions = makeActions()
    routeNoteClick(entry, makeMouseEvent({ metaKey: true, shiftKey: true }), actions)
    expect(actions.onOpenInNewWindow).toHaveBeenCalledWith(entry)
    expect(actions.onReplace).not.toHaveBeenCalled()
    expect(actions.onSelect).not.toHaveBeenCalled()
  })

  it('Cmd+Shift+click is a no-op when handler is undefined', () => {
    const entry = makeEntry()
    const actions = makeActions()
    actions.onOpenInNewWindow = undefined
    routeNoteClick(entry, makeMouseEvent({ metaKey: true, shiftKey: true }), actions)
    expect(actions.onReplace).not.toHaveBeenCalled()
    expect(actions.onSelect).not.toHaveBeenCalled()
  })
})
