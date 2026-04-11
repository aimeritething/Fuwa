import type { ViewMode } from './useViewMode'
import { trackEvent } from '../lib/telemetry'
import { isTauri } from '../mock-tauri'
import {
  APP_COMMAND_IDS,
  dispatchAppCommand,
  type AppCommandId,
  type AppCommandHandlers,
} from './appCommandDispatcher'

export type KeyboardActions = Pick<
  AppCommandHandlers,
  | 'onQuickOpen'
  | 'onCommandPalette'
  | 'onSearch'
  | 'onCreateNote'
  | 'onOpenDailyNote'
  | 'onSave'
  | 'onOpenSettings'
  | 'onDeleteNote'
  | 'onArchiveNote'
  | 'onSetViewMode'
  | 'onZoomIn'
  | 'onZoomOut'
  | 'onZoomReset'
  | 'onGoBack'
  | 'onGoForward'
  | 'onToggleAIChat'
  | 'onToggleRawEditor'
  | 'onToggleInspector'
  | 'onToggleFavorite'
  | 'onToggleOrganized'
  | 'onOpenInNewWindow'
  | 'activeTabPathRef'
>

type ShortcutMap = Record<string, AppCommandId>
type NativeMenuCombo = 'command' | 'command-shift'

const TEXT_EDITING_KEYS = new Set(['Backspace', 'Delete'])
const TAURI_NATIVE_MENU_KEYS: Record<NativeMenuCombo, Set<string>> = {
  command: new Set([',', '1', '2', '3', 'n', 'j', 'p', 's', 'k', '=', '+', '-', '0', '[', ']', '\\', 'e', 'Backspace', 'Delete']),
  'command-shift': new Set(['f', 'i', 'o', 'l']),
}

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

function nativeMenuComboForEvent(e: KeyboardEvent): NativeMenuCombo | null {
  if (isCommandShiftOnly(e)) return 'command-shift'
  if (isCommandOrCtrlOnly(e) && e.shiftKey === false) return 'command'
  return null
}

function shouldDeferToNativeMenu(e: KeyboardEvent): boolean {
  if (!isTauri()) return false
  const combo = nativeMenuComboForEvent(e)
  if (combo === null) return false
  const normalizedKey = combo === 'command-shift' ? e.key.toLowerCase() : e.key
  return TAURI_NATIVE_MENU_KEYS[combo].has(normalizedKey)
}

export function createCommandKeyMap(): ShortcutMap {
  return {
    k: APP_COMMAND_IDS.viewCommandPalette,
    p: APP_COMMAND_IDS.fileQuickOpen,
    n: APP_COMMAND_IDS.fileNewNote,
    j: APP_COMMAND_IDS.fileDailyNote,
    s: APP_COMMAND_IDS.fileSave,
    ',': APP_COMMAND_IDS.appSettings,
    d: APP_COMMAND_IDS.noteToggleFavorite,
    e: APP_COMMAND_IDS.noteToggleOrganized,
    Backspace: APP_COMMAND_IDS.noteDelete,
    Delete: APP_COMMAND_IDS.noteDelete,
    '[': APP_COMMAND_IDS.viewGoBack,
    ']': APP_COMMAND_IDS.viewGoForward,
    '=': APP_COMMAND_IDS.viewZoomIn,
    '+': APP_COMMAND_IDS.viewZoomIn,
    '-': APP_COMMAND_IDS.viewZoomOut,
    '0': APP_COMMAND_IDS.viewZoomReset,
    '\\': APP_COMMAND_IDS.editToggleRawEditor,
  }
}

export function createShiftCommandKeyMap(): ShortcutMap {
  return {
    f: APP_COMMAND_IDS.editFindInVault,
    i: APP_COMMAND_IDS.viewToggleProperties,
    o: APP_COMMAND_IDS.noteOpenInNewWindow,
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

export function handleCommandKey(e: KeyboardEvent, keyMap: ShortcutMap, actions: KeyboardActions): boolean {
  if (isCommandOrCtrlOnly(e) === false || e.shiftKey) return false
  const commandId = keyMap[e.key]
  if (commandId === undefined) return false
  if (TEXT_EDITING_KEYS.has(e.key) && isTextInputFocused()) return false
  e.preventDefault()
  dispatchAppCommand(commandId, actions)
  return true
}

export function handleAiPanelKey(e: KeyboardEvent, actions: KeyboardActions): boolean {
  const matchesAiPanelShortcut = e.code === 'KeyL' || e.key.toLowerCase() === 'l'
  if (isCommandShiftOnly(e) === false || matchesAiPanelShortcut === false || actions.onToggleAIChat === undefined) return false
  e.preventDefault()
  dispatchAppCommand(APP_COMMAND_IDS.viewToggleAiChat, actions)
  return true
}

export function handleShiftCommandKey(e: KeyboardEvent, keyMap: ShortcutMap, actions: KeyboardActions): boolean {
  if (isCommandOrCtrlShiftOnly(e) === false) return false
  const commandId = keyMap[e.key.toLowerCase()]
  if (commandId === undefined) return false
  e.preventDefault()
  if (commandId === APP_COMMAND_IDS.editFindInVault) {
    trackEvent('search_used')
  }
  dispatchAppCommand(commandId, actions)
  return true
}

export function handleAppKeyboardEvent(actions: KeyboardActions, event: KeyboardEvent) {
  if (shouldDeferToNativeMenu(event)) return
  if (handleAiPanelKey(event, actions)) return
  const shiftKeyMap = createShiftCommandKeyMap()
  if (handleShiftCommandKey(event, shiftKeyMap, actions)) return
  if (handleViewModeKey(event, actions.onSetViewMode)) return
  const cmdKeyMap = createCommandKeyMap()
  handleCommandKey(event, cmdKeyMap, actions)
}
