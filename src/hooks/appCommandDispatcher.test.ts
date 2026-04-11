import { describe, expect, it, vi } from 'vitest'
import {
  APP_COMMAND_IDS,
  dispatchAppCommand,
  findShortcutCommandId,
  findShortcutCommandIdForEvent,
  isAppCommandId,
  isNativeMenuCommandId,
  isNativeMenuShortcutCommand,
  type AppCommandHandlers,
} from './appCommandDispatcher'

function makeHandlers(): AppCommandHandlers {
  return {
    onSetViewMode: vi.fn(),
    onCreateNote: vi.fn(),
    onCreateType: vi.fn(),
    onOpenDailyNote: vi.fn(),
    onQuickOpen: vi.fn(),
    onSave: vi.fn(),
    onOpenSettings: vi.fn(),
    onToggleInspector: vi.fn(),
    onCommandPalette: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onZoomReset: vi.fn(),
    onToggleOrganized: vi.fn(),
    onToggleFavorite: vi.fn(),
    onArchiveNote: vi.fn(),
    onDeleteNote: vi.fn(),
    onSearch: vi.fn(),
    onToggleRawEditor: vi.fn(),
    onToggleDiff: vi.fn(),
    onToggleAIChat: vi.fn(),
    onGoBack: vi.fn(),
    onGoForward: vi.fn(),
    onCheckForUpdates: vi.fn(),
    onSelectFilter: vi.fn(),
    onOpenVault: vi.fn(),
    onRemoveActiveVault: vi.fn(),
    onRestoreGettingStarted: vi.fn(),
    onCommitPush: vi.fn(),
    onPull: vi.fn(),
    onResolveConflicts: vi.fn(),
    onViewChanges: vi.fn(),
    onInstallMcp: vi.fn(),
    onOpenInNewWindow: vi.fn(),
    onReloadVault: vi.fn(),
    onRepairVault: vi.fn(),
    onRestoreDeletedNote: vi.fn(),
    activeTabPathRef: { current: '/vault/test.md' },
  }
}

describe('appCommandDispatcher', () => {
  it('recognizes valid command ids', () => {
    expect(isAppCommandId(APP_COMMAND_IDS.fileNewNote)).toBe(true)
    expect(isAppCommandId('not-a-command')).toBe(false)
  })

  it('distinguishes native menu ids from keyboard-only ids', () => {
    expect(isNativeMenuCommandId(APP_COMMAND_IDS.fileNewNote)).toBe(true)
    expect(isNativeMenuCommandId(APP_COMMAND_IDS.noteToggleFavorite)).toBe(false)
  })

  it('matches shortcut ownership from the shared catalog', () => {
    expect(isNativeMenuShortcutCommand(APP_COMMAND_IDS.fileNewNote)).toBe(true)
    expect(isNativeMenuShortcutCommand(APP_COMMAND_IDS.noteToggleFavorite)).toBe(false)
  })

  it('finds raw editor and AI shortcuts from the shared catalog', () => {
    expect(findShortcutCommandId('command-or-ctrl', '\\')).toBe(APP_COMMAND_IDS.editToggleRawEditor)
    expect(findShortcutCommandId('command-shift', '¬', 'KeyL')).toBe(APP_COMMAND_IDS.viewToggleAiChat)
  })

  it('resolves event modifiers through the shared shortcut catalog', () => {
    expect(
      findShortcutCommandIdForEvent({
        key: '¬',
        code: 'KeyL',
        altKey: false,
        ctrlKey: false,
        metaKey: true,
        shiftKey: true,
      }),
    ).toBe(APP_COMMAND_IDS.viewToggleAiChat)
    expect(
      findShortcutCommandIdForEvent({
        key: 'I',
        code: 'KeyI',
        altKey: false,
        ctrlKey: false,
        metaKey: true,
        shiftKey: true,
      }),
    ).toBe(APP_COMMAND_IDS.viewToggleProperties)
    expect(
      findShortcutCommandIdForEvent({
        key: 'l',
        code: 'KeyL',
        altKey: false,
        ctrlKey: true,
        metaKey: false,
        shiftKey: true,
      }),
    ).toBeNull()
  })

  it('dispatches create note through the shared command path', () => {
    const handlers = makeHandlers()
    expect(dispatchAppCommand(APP_COMMAND_IDS.fileNewNote, handlers)).toBe(true)
    expect(handlers.onCreateNote).toHaveBeenCalled()
  })

  it('dispatches inspector toggle through the shared command path', () => {
    const handlers = makeHandlers()
    expect(dispatchAppCommand(APP_COMMAND_IDS.viewToggleProperties, handlers)).toBe(true)
    expect(handlers.onToggleInspector).toHaveBeenCalled()
  })

  it('dispatches AI panel toggle through the shared command path', () => {
    const handlers = makeHandlers()
    expect(dispatchAppCommand(APP_COMMAND_IDS.viewToggleAiChat, handlers)).toBe(true)
    expect(handlers.onToggleAIChat).toHaveBeenCalled()
  })

  it('uses the active note for note-scoped commands', () => {
    const handlers = makeHandlers()
    expect(dispatchAppCommand(APP_COMMAND_IDS.noteToggleFavorite, handlers)).toBe(true)
    expect(dispatchAppCommand(APP_COMMAND_IDS.noteToggleOrganized, handlers)).toBe(true)
    expect(dispatchAppCommand(APP_COMMAND_IDS.noteDelete, handlers)).toBe(true)
    expect(handlers.onToggleFavorite).toHaveBeenCalledWith('/vault/test.md')
    expect(handlers.onToggleOrganized).toHaveBeenCalledWith('/vault/test.md')
    expect(handlers.onDeleteNote).toHaveBeenCalledWith('/vault/test.md')
  })

  it('no-ops note-scoped commands when there is no active note', () => {
    const handlers = makeHandlers()
    handlers.activeTabPathRef.current = null
    expect(dispatchAppCommand(APP_COMMAND_IDS.noteToggleFavorite, handlers)).toBe(false)
    expect(dispatchAppCommand(APP_COMMAND_IDS.noteToggleOrganized, handlers)).toBe(false)
    expect(dispatchAppCommand(APP_COMMAND_IDS.noteDelete, handlers)).toBe(false)
    expect(handlers.onToggleFavorite).not.toHaveBeenCalled()
    expect(handlers.onToggleOrganized).not.toHaveBeenCalled()
    expect(handlers.onDeleteNote).not.toHaveBeenCalled()
  })

  it('dispatches navigation filters through the same shared command path', () => {
    const handlers = makeHandlers()
    expect(dispatchAppCommand(APP_COMMAND_IDS.goChanges, handlers)).toBe(true)
    expect(handlers.onSelectFilter).toHaveBeenCalledWith('changes')
  })
})
