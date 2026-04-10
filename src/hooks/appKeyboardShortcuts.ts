import type { MutableRefObject } from 'react'
import type { ViewMode } from './useViewMode'
import { trackEvent } from '../lib/telemetry'

export interface KeyboardActions {
  onQuickOpen: () => void
  onCommandPalette: () => void
  onSearch: () => void
  onCreateNote: () => void
  onOpenDailyNote: () => void
  onSave: () => void
  onOpenSettings: () => void
  onDeleteNote: (path: string) => void
  onArchiveNote: (path: string) => void
  onSetViewMode: (mode: ViewMode) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onGoBack?: () => void
  onGoForward?: () => void
  onToggleAIChat?: () => void
  onToggleRawEditor?: () => void
  onToggleInspector?: () => void
  onToggleFavorite?: (path: string) => void
  onToggleOrganized?: (path: string) => void
  onOpenInNewWindow?: () => void
  activeTabPathRef: MutableRefObject<string | null>
}

type ShortcutHandler = () => void
type ShortcutMap = Record<string, ShortcutHandler>

const TEXT_EDITING_KEYS = new Set(['Backspace', 'Delete'])

const VIEW_MODE_KEYS: Record<string, ViewMode> = {
  '1': 'editor-only',
  '2': 'editor-list',
  '3': 'all',
}

function isTextInputFocused(): boolean {
  const active = document.activeElement
  if (!(active instanceof HTMLElement)) return false
  if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') return true
  return active.isContentEditable || active.closest('[contenteditable="true"]') !== null
}

function isCommandOrCtrlOnly(e: KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && e.altKey === false
}

function isCommandOrCtrlShiftOnly(e: KeyboardEvent): boolean {
  return isCommandOrCtrlOnly(e) && e.shiftKey
}

function isCommandShiftOnly(e: KeyboardEvent): boolean {
  return e.metaKey && e.ctrlKey === false && e.altKey === false && e.shiftKey
}

function withActiveTab(
  activeTabPathRef: MutableRefObject<string | null>,
  handler: (path: string) => void,
): ShortcutHandler {
  return () => {
    const path = activeTabPathRef.current
    if (path) handler(path)
  }
}

export function createCommandKeyMap(actions: KeyboardActions): ShortcutMap {
  const { activeTabPathRef } = actions

  return {
    k: actions.onCommandPalette,
    p: actions.onQuickOpen,
    n: actions.onCreateNote,
    j: actions.onOpenDailyNote,
    s: actions.onSave,
    ',': actions.onOpenSettings,
    d: withActiveTab(activeTabPathRef, (path) => actions.onToggleFavorite?.(path)),
    e: withActiveTab(activeTabPathRef, (path) => actions.onToggleOrganized?.(path)),
    Backspace: withActiveTab(activeTabPathRef, actions.onDeleteNote),
    Delete: withActiveTab(activeTabPathRef, actions.onDeleteNote),
    '[': () => actions.onGoBack?.(),
    ']': () => actions.onGoForward?.(),
    '=': actions.onZoomIn,
    '+': actions.onZoomIn,
    '-': actions.onZoomOut,
    '0': actions.onZoomReset,
    '\\': () => actions.onToggleRawEditor?.(),
  }
}

export function createShiftCommandKeyMap(actions: KeyboardActions): ShortcutMap {
  return {
    f: () => {
      trackEvent('search_used')
      actions.onSearch()
    },
    i: () => actions.onToggleInspector?.(),
    o: () => actions.onOpenInNewWindow?.(),
  }
}

export function handleViewModeKey(e: KeyboardEvent, onSetViewMode: (mode: ViewMode) => void): boolean {
  if (isCommandOrCtrlOnly(e) === false || e.shiftKey) return false
  const mode = VIEW_MODE_KEYS[e.key]
  if (mode === undefined) return false
  e.preventDefault()
  onSetViewMode(mode)
  return true
}

export function handleCommandKey(e: KeyboardEvent, keyMap: ShortcutMap): boolean {
  if (isCommandOrCtrlOnly(e) === false || e.shiftKey) return false
  const handler = keyMap[e.key]
  if (handler === undefined) return false
  if (TEXT_EDITING_KEYS.has(e.key) && isTextInputFocused()) return false
  e.preventDefault()
  handler()
  return true
}

export function handleAiPanelKey(e: KeyboardEvent, onToggleAIChat?: () => void): boolean {
  const matchesAiPanelShortcut = e.code === 'KeyL' || e.key.toLowerCase() === 'l'
  if (isCommandShiftOnly(e) === false || matchesAiPanelShortcut === false || onToggleAIChat === undefined) return false
  e.preventDefault()
  onToggleAIChat()
  return true
}

export function handleShiftCommandKey(e: KeyboardEvent, keyMap: ShortcutMap): boolean {
  if (isCommandOrCtrlShiftOnly(e) === false) return false
  const handler = keyMap[e.key.toLowerCase()]
  if (handler === undefined) return false
  e.preventDefault()
  handler()
  return true
}

export function handleAppKeyboardEvent(actions: KeyboardActions, event: KeyboardEvent) {
  if (handleAiPanelKey(event, actions.onToggleAIChat)) return
  const shiftKeyMap = createShiftCommandKeyMap(actions)
  if (handleShiftCommandKey(event, shiftKeyMap)) return
  if (handleViewModeKey(event, actions.onSetViewMode)) return
  const cmdKeyMap = createCommandKeyMap(actions)
  handleCommandKey(event, cmdKeyMap)
}
