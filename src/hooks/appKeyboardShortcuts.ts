import { trackEvent } from '../lib/telemetry'
import { isTauri } from '../mock-tauri'
import {
  APP_COMMAND_IDS,
  dispatchAppCommand,
  findShortcutCommandIdForEvent,
  isNativeMenuShortcutCommand,
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

const TEXT_EDITING_KEYS = new Set(['Backspace', 'Delete'])

function isTextInputFocused(): boolean {
  const active = document.activeElement
  if (!(active instanceof HTMLElement)) return false
  if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') return true
  return active.isContentEditable || active.closest('[contenteditable="true"]') !== null
}

export function handleAppKeyboardEvent(actions: KeyboardActions, event: KeyboardEvent) {
  const commandId = findShortcutCommandIdForEvent(event)
  if (commandId === null) return
  if (TEXT_EDITING_KEYS.has(event.key) && isTextInputFocused()) return
  if (isTauri() && isNativeMenuShortcutCommand(commandId)) return

  event.preventDefault()
  if (commandId === APP_COMMAND_IDS.editFindInVault) {
    trackEvent('search_used')
  }
  dispatchAppCommand(commandId, actions)
}
