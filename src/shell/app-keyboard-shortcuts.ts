import {
  APP_COMMAND_IDS,
  executeAppCommand,
  findShortcutCommandIdForEvent,
  recordSuppressedShortcutCommand,
  type AppCommandId,
  type AppCommandHandlers,
} from './app-command-dispatcher'

export type KeyboardActions = Pick<
  AppCommandHandlers,
  | 'onQuit'
  | 'onQuickOpen'
  | 'onCommandPalette'
  | 'onCreateNote'
  | 'onOpenVault'
  | 'onOpenNote'
  | 'onCloseVault'
  | 'onSave'
  | 'onCloseTab'
  | 'onUndo'
  | 'onRedo'
  | 'onFindInNote'
  | 'onPastePlainText'
  | 'onZoomIn'
  | 'onZoomOut'
  | 'onZoomReset'
  | 'onToggleSidebar'
  | 'onToggleRawEditor'
  | 'onCopyPath'
  | 'onAppearanceSystem'
  | 'onAppearanceDark'
  | 'onAppearanceLight'
  | 'onPreviousTab'
  | 'onNextTab'
  | 'onJumpToTab1'
  | 'onJumpToTab2'
  | 'onJumpToTab3'
  | 'onJumpToTab4'
  | 'onJumpToTab5'
  | 'onJumpToTab6'
  | 'onJumpToTab7'
  | 'onJumpToTab8'
  | 'onJumpToTab9'
> & {
  canUndo?: boolean
  canRedo?: boolean
}

const TEXT_EDITING_KEYS = new Set(['Backspace', 'Delete'])
const TEXT_EDITING_BLOCKED_COMMANDS = new Set<AppCommandId>([
  APP_COMMAND_IDS.editUndo,
  APP_COMMAND_IDS.editRedo,
])

function isTextInputFocused(): boolean {
  const active = document.activeElement
  if (!(active instanceof HTMLElement)) return false
  if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') return true
  return active.isContentEditable || active.closest('[contenteditable="true"]') !== null
}

function shouldFocusedTextOwnCommand(commandId: AppCommandId, key: string): boolean {
  return TEXT_EDITING_KEYS.has(key) || TEXT_EDITING_BLOCKED_COMMANDS.has(commandId)
}

function handleFocusedTextCommand(event: KeyboardEvent, commandId: AppCommandId): boolean {
  if (!isTextInputFocused()) return false
  if (!shouldFocusedTextOwnCommand(commandId, event.key)) return false
  recordSuppressedShortcutCommand(commandId, 'renderer-keyboard')
  return true
}

function isEditorFindScopeFocused(): boolean {
  const active = document.activeElement
  if (!(active instanceof HTMLElement)) return false
  return active.closest('[data-editor-find-scope="true"]') !== null
}

function selectionBelongsToEditor(editor: Element, selection: Selection): boolean {
  const { anchorNode, focusNode } = selection
  if (!anchorNode || !focusNode) return false
  return editor.contains(anchorNode) && editor.contains(focusNode)
}

function activeRichEditor(): Element | null {
  const active = document.activeElement
  return active instanceof HTMLElement ? active.closest('.bn-editor') : null
}

function activeTextSelection(): Selection | null {
  const selection = window.getSelection()
  return selection && !selection.isCollapsed && selection.rangeCount > 0 ? selection : null
}

function hasActiveRichEditorTextSelection(): boolean {
  const editor = activeRichEditor()
  const selection = activeTextSelection()
  return Boolean(editor && selection && selectionBelongsToEditor(editor, selection))
}

function activateRichEditorCreateLink(): boolean {
  const button = document.querySelector<HTMLButtonElement>('[data-test="createLink"]')
  if (!button) return false
  button.click()
  return true
}

/**
 * ⌘K over a non-empty Rich selection is the editor's link command. With no
 * link button mounted to press, the chord falls through to the Command Menu
 * rather than doing nothing.
 */
function handleRichEditorCreateLinkShortcut(event: KeyboardEvent): boolean {
  if (!hasActiveRichEditorTextSelection()) return false
  if (!activateRichEditorCreateLink()) return false
  event.preventDefault()
  event.stopPropagation()
  return true
}

/** The chords the Command Menu lets through while it is open: its own two, so they switch or close it, and Quit. */
const COMMAND_MENU_PASSTHROUGH = new Set<AppCommandId>([
  APP_COMMAND_IDS.viewCommandPalette,
  APP_COMMAND_IDS.fileQuickOpen,
  APP_COMMAND_IDS.appQuit,
])

function isCommandMenuFocused(): boolean {
  const active = document.activeElement
  return active instanceof HTMLElement && active.closest('[data-command-palette="true"]') !== null
}

/** The palette is modal: ⌘W, ⌘N and the rest must not act on the window behind it. */
function handleCommandMenuModalCommand(event: KeyboardEvent, commandId: AppCommandId): boolean {
  if (!isCommandMenuFocused() || COMMAND_MENU_PASSTHROUGH.has(commandId)) return false
  event.preventDefault()
  return true
}

export function handleAppKeyboardEvent(actions: KeyboardActions, event: KeyboardEvent) {
  const commandId = findShortcutCommandIdForEvent(event)
  if (commandId === null) return
  // ⌘F is the Document's find (both modes) unless the caret is
  // in some other text field, the Command Menu's input or an Explorer rename,
  // which keeps the chord.
  if (commandId === APP_COMMAND_IDS.editFindInNote && isTextInputFocused() && !isEditorFindScopeFocused()) return
  if (
    commandId === APP_COMMAND_IDS.viewCommandPalette
    && handleRichEditorCreateLinkShortcut(event)
  ) return

  if (handleCommandMenuModalCommand(event, commandId)) return
  if (handleFocusedTextCommand(event, commandId)) return

  event.preventDefault()
  executeAppCommand(commandId, actions, 'renderer-keyboard')
}
