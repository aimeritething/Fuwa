import type { MutableRefObject } from 'react'
import type { SidebarFilter } from '../types'
import type { ViewMode } from './useViewMode'

export const APP_COMMAND_EVENT_NAME = 'laputa:dispatch-command'
export const APP_MENU_EVENT_NAME = 'laputa:dispatch-menu-command'

export const APP_COMMAND_IDS = {
  appSettings: 'app-settings',
  appCheckForUpdates: 'app-check-for-updates',
  fileNewNote: 'file-new-note',
  fileNewType: 'file-new-type',
  fileDailyNote: 'file-daily-note',
  fileQuickOpen: 'file-quick-open',
  fileSave: 'file-save',
  editFindInVault: 'edit-find-in-vault',
  editToggleRawEditor: 'edit-toggle-raw-editor',
  editToggleDiff: 'edit-toggle-diff',
  viewEditorOnly: 'view-editor-only',
  viewEditorList: 'view-editor-list',
  viewAll: 'view-all',
  viewToggleProperties: 'view-toggle-properties',
  viewToggleAiChat: 'view-toggle-ai-chat',
  viewToggleBacklinks: 'view-toggle-backlinks',
  viewCommandPalette: 'view-command-palette',
  viewZoomIn: 'view-zoom-in',
  viewZoomOut: 'view-zoom-out',
  viewZoomReset: 'view-zoom-reset',
  viewGoBack: 'view-go-back',
  viewGoForward: 'view-go-forward',
  goAllNotes: 'go-all-notes',
  goArchived: 'go-archived',
  goChanges: 'go-changes',
  goInbox: 'go-inbox',
  noteToggleOrganized: 'note-toggle-organized',
  noteToggleFavorite: 'note-toggle-favorite',
  noteArchive: 'note-archive',
  noteDelete: 'note-delete',
  noteOpenInNewWindow: 'note-open-in-new-window',
  noteRestoreDeleted: 'note-restore-deleted',
  vaultOpen: 'vault-open',
  vaultRemove: 'vault-remove',
  vaultRestoreGettingStarted: 'vault-restore-getting-started',
  vaultCommitPush: 'vault-commit-push',
  vaultPull: 'vault-pull',
  vaultResolveConflicts: 'vault-resolve-conflicts',
  vaultViewChanges: 'vault-view-changes',
  vaultInstallMcp: 'vault-install-mcp',
  vaultReload: 'vault-reload',
  vaultRepair: 'vault-repair',
} as const

export type AppCommandId = (typeof APP_COMMAND_IDS)[keyof typeof APP_COMMAND_IDS]

const VIEW_MODE_COMMANDS: Partial<Record<AppCommandId, ViewMode>> = {
  [APP_COMMAND_IDS.viewEditorOnly]: 'editor-only',
  [APP_COMMAND_IDS.viewEditorList]: 'editor-list',
  [APP_COMMAND_IDS.viewAll]: 'all',
}

const FILTER_COMMANDS: Partial<Record<AppCommandId, SidebarFilter>> = {
  [APP_COMMAND_IDS.goAllNotes]: 'all',
  [APP_COMMAND_IDS.goArchived]: 'archived',
  [APP_COMMAND_IDS.goChanges]: 'changes',
  [APP_COMMAND_IDS.goInbox]: 'inbox',
}

const APP_COMMAND_SET = new Set<string>(Object.values(APP_COMMAND_IDS))

const NATIVE_MENU_COMMAND_IDS = [
  APP_COMMAND_IDS.appSettings,
  APP_COMMAND_IDS.appCheckForUpdates,
  APP_COMMAND_IDS.fileNewNote,
  APP_COMMAND_IDS.fileNewType,
  APP_COMMAND_IDS.fileDailyNote,
  APP_COMMAND_IDS.fileQuickOpen,
  APP_COMMAND_IDS.fileSave,
  APP_COMMAND_IDS.editFindInVault,
  APP_COMMAND_IDS.editToggleRawEditor,
  APP_COMMAND_IDS.editToggleDiff,
  APP_COMMAND_IDS.viewEditorOnly,
  APP_COMMAND_IDS.viewEditorList,
  APP_COMMAND_IDS.viewAll,
  APP_COMMAND_IDS.viewToggleProperties,
  APP_COMMAND_IDS.viewToggleAiChat,
  APP_COMMAND_IDS.viewToggleBacklinks,
  APP_COMMAND_IDS.viewCommandPalette,
  APP_COMMAND_IDS.viewZoomIn,
  APP_COMMAND_IDS.viewZoomOut,
  APP_COMMAND_IDS.viewZoomReset,
  APP_COMMAND_IDS.viewGoBack,
  APP_COMMAND_IDS.viewGoForward,
  APP_COMMAND_IDS.goAllNotes,
  APP_COMMAND_IDS.goArchived,
  APP_COMMAND_IDS.goChanges,
  APP_COMMAND_IDS.goInbox,
  APP_COMMAND_IDS.noteToggleOrganized,
  APP_COMMAND_IDS.noteArchive,
  APP_COMMAND_IDS.noteDelete,
  APP_COMMAND_IDS.noteOpenInNewWindow,
  APP_COMMAND_IDS.noteRestoreDeleted,
  APP_COMMAND_IDS.vaultOpen,
  APP_COMMAND_IDS.vaultRemove,
  APP_COMMAND_IDS.vaultRestoreGettingStarted,
  APP_COMMAND_IDS.vaultCommitPush,
  APP_COMMAND_IDS.vaultPull,
  APP_COMMAND_IDS.vaultResolveConflicts,
  APP_COMMAND_IDS.vaultViewChanges,
  APP_COMMAND_IDS.vaultInstallMcp,
  APP_COMMAND_IDS.vaultReload,
  APP_COMMAND_IDS.vaultRepair,
] as const

const NATIVE_MENU_COMMAND_SET = new Set<string>(NATIVE_MENU_COMMAND_IDS)

export type NativeMenuCommandId = (typeof NATIVE_MENU_COMMAND_IDS)[number]

export interface AppCommandHandlers {
  onSetViewMode: (mode: ViewMode) => void
  onCreateNote: () => void
  onCreateType?: () => void
  onOpenDailyNote: () => void
  onQuickOpen: () => void
  onSave: () => void
  onOpenSettings: () => void
  onToggleInspector: () => void
  onCommandPalette: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onToggleOrganized?: (path: string) => void
  onToggleFavorite?: (path: string) => void
  onArchiveNote: (path: string) => void
  onDeleteNote: (path: string) => void
  onSearch: () => void
  onToggleRawEditor?: () => void
  onToggleDiff?: () => void
  onToggleAIChat?: () => void
  onGoBack?: () => void
  onGoForward?: () => void
  onCheckForUpdates?: () => void
  onSelectFilter?: (filter: SidebarFilter) => void
  onOpenVault?: () => void
  onRemoveActiveVault?: () => void
  onRestoreGettingStarted?: () => void
  onCommitPush?: () => void
  onPull?: () => void
  onResolveConflicts?: () => void
  onViewChanges?: () => void
  onInstallMcp?: () => void
  onOpenInNewWindow?: () => void
  onReloadVault?: () => void
  onRepairVault?: () => void
  onRestoreDeletedNote?: () => void
  activeTabPathRef: MutableRefObject<string | null>
}

function dispatchActiveTabCommand(
  pathRef: MutableRefObject<string | null>,
  onPath: (path: string) => void,
): boolean {
  const path = pathRef.current
  if (!path) return false
  onPath(path)
  return true
}

export function isAppCommandId(value: string): value is AppCommandId {
  return APP_COMMAND_SET.has(value)
}

export function isNativeMenuCommandId(value: string): value is NativeMenuCommandId {
  return NATIVE_MENU_COMMAND_SET.has(value)
}

export function dispatchAppCommand(id: AppCommandId, handlers: AppCommandHandlers): boolean {
  const viewMode = VIEW_MODE_COMMANDS[id]
  if (viewMode) {
    handlers.onSetViewMode(viewMode)
    return true
  }

  const filter = FILTER_COMMANDS[id]
  if (filter) {
    handlers.onSelectFilter?.(filter)
    return true
  }

  switch (id) {
    case APP_COMMAND_IDS.appSettings:
      handlers.onOpenSettings()
      return true
    case APP_COMMAND_IDS.appCheckForUpdates:
      handlers.onCheckForUpdates?.()
      return true
    case APP_COMMAND_IDS.fileNewNote:
      handlers.onCreateNote()
      return true
    case APP_COMMAND_IDS.fileNewType:
      handlers.onCreateType?.()
      return true
    case APP_COMMAND_IDS.fileDailyNote:
      handlers.onOpenDailyNote()
      return true
    case APP_COMMAND_IDS.fileQuickOpen:
      handlers.onQuickOpen()
      return true
    case APP_COMMAND_IDS.fileSave:
      handlers.onSave()
      return true
    case APP_COMMAND_IDS.editFindInVault:
      handlers.onSearch()
      return true
    case APP_COMMAND_IDS.editToggleRawEditor:
      handlers.onToggleRawEditor?.()
      return true
    case APP_COMMAND_IDS.editToggleDiff:
      handlers.onToggleDiff?.()
      return true
    case APP_COMMAND_IDS.viewToggleProperties:
    case APP_COMMAND_IDS.viewToggleBacklinks:
      handlers.onToggleInspector()
      return true
    case APP_COMMAND_IDS.viewToggleAiChat:
      handlers.onToggleAIChat?.()
      return true
    case APP_COMMAND_IDS.viewCommandPalette:
      handlers.onCommandPalette()
      return true
    case APP_COMMAND_IDS.viewZoomIn:
      handlers.onZoomIn()
      return true
    case APP_COMMAND_IDS.viewZoomOut:
      handlers.onZoomOut()
      return true
    case APP_COMMAND_IDS.viewZoomReset:
      handlers.onZoomReset()
      return true
    case APP_COMMAND_IDS.viewGoBack:
      handlers.onGoBack?.()
      return true
    case APP_COMMAND_IDS.viewGoForward:
      handlers.onGoForward?.()
      return true
    case APP_COMMAND_IDS.noteToggleOrganized:
      return dispatchActiveTabCommand(handlers.activeTabPathRef, (path) => handlers.onToggleOrganized?.(path))
    case APP_COMMAND_IDS.noteToggleFavorite:
      return dispatchActiveTabCommand(handlers.activeTabPathRef, (path) => handlers.onToggleFavorite?.(path))
    case APP_COMMAND_IDS.noteArchive:
      return dispatchActiveTabCommand(handlers.activeTabPathRef, handlers.onArchiveNote)
    case APP_COMMAND_IDS.noteDelete:
      return dispatchActiveTabCommand(handlers.activeTabPathRef, handlers.onDeleteNote)
    case APP_COMMAND_IDS.noteOpenInNewWindow:
      handlers.onOpenInNewWindow?.()
      return true
    case APP_COMMAND_IDS.noteRestoreDeleted:
      handlers.onRestoreDeletedNote?.()
      return true
    case APP_COMMAND_IDS.vaultOpen:
      handlers.onOpenVault?.()
      return true
    case APP_COMMAND_IDS.vaultRemove:
      handlers.onRemoveActiveVault?.()
      return true
    case APP_COMMAND_IDS.vaultRestoreGettingStarted:
      handlers.onRestoreGettingStarted?.()
      return true
    case APP_COMMAND_IDS.vaultCommitPush:
      handlers.onCommitPush?.()
      return true
    case APP_COMMAND_IDS.vaultPull:
      handlers.onPull?.()
      return true
    case APP_COMMAND_IDS.vaultResolveConflicts:
      handlers.onResolveConflicts?.()
      return true
    case APP_COMMAND_IDS.vaultViewChanges:
      handlers.onViewChanges?.()
      return true
    case APP_COMMAND_IDS.vaultInstallMcp:
      handlers.onInstallMcp?.()
      return true
    case APP_COMMAND_IDS.vaultReload:
      handlers.onReloadVault?.()
      return true
    case APP_COMMAND_IDS.vaultRepair:
      handlers.onRepairVault?.()
      return true
  }
}
