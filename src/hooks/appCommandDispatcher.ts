import type { MutableRefObject } from 'react'
import type { SidebarFilter } from '../types'
import {
  APP_COMMAND_DEFINITIONS,
  type AppCommandId,
  type AppCommandDefinition,
} from './appCommandCatalog'
import type { ViewMode } from './useViewMode'

export const APP_COMMAND_EVENT_NAME = 'laputa:dispatch-command'

export {
  APP_COMMAND_IDS,
  findShortcutCommandId,
  findShortcutCommandIdForEvent,
  isAppCommandId,
  isNativeMenuCommandId,
  isNativeMenuShortcutCommand,
} from './appCommandCatalog'
export type { AppCommandDefinition, AppCommandId, AppCommandShortcutCombo } from './appCommandCatalog'

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

type SimpleHandlerKey = keyof Pick<
  AppCommandHandlers,
  | 'onOpenSettings'
  | 'onCheckForUpdates'
  | 'onCreateNote'
  | 'onCreateType'
  | 'onOpenDailyNote'
  | 'onQuickOpen'
  | 'onSave'
  | 'onSearch'
  | 'onToggleRawEditor'
  | 'onToggleDiff'
  | 'onToggleInspector'
  | 'onToggleAIChat'
  | 'onCommandPalette'
  | 'onZoomIn'
  | 'onZoomOut'
  | 'onZoomReset'
  | 'onGoBack'
  | 'onGoForward'
  | 'onOpenVault'
  | 'onRemoveActiveVault'
  | 'onRestoreGettingStarted'
  | 'onCommitPush'
  | 'onPull'
  | 'onResolveConflicts'
  | 'onViewChanges'
  | 'onInstallMcp'
  | 'onReloadVault'
  | 'onRepairVault'
  | 'onOpenInNewWindow'
  | 'onRestoreDeletedNote'
>

type ActiveTabHandlerKey = keyof Pick<
  AppCommandHandlers,
  'onToggleOrganized' | 'onToggleFavorite' | 'onArchiveNote' | 'onDeleteNote'
>

const SIMPLE_HANDLER_EXECUTORS: Record<SimpleHandlerKey, (handlers: AppCommandHandlers) => void> = {
  onOpenSettings: (handlers) => handlers.onOpenSettings(),
  onCheckForUpdates: (handlers) => handlers.onCheckForUpdates?.(),
  onCreateNote: (handlers) => handlers.onCreateNote(),
  onCreateType: (handlers) => handlers.onCreateType?.(),
  onOpenDailyNote: (handlers) => handlers.onOpenDailyNote(),
  onQuickOpen: (handlers) => handlers.onQuickOpen(),
  onSave: (handlers) => handlers.onSave(),
  onSearch: (handlers) => handlers.onSearch(),
  onToggleRawEditor: (handlers) => handlers.onToggleRawEditor?.(),
  onToggleDiff: (handlers) => handlers.onToggleDiff?.(),
  onToggleInspector: (handlers) => handlers.onToggleInspector(),
  onToggleAIChat: (handlers) => handlers.onToggleAIChat?.(),
  onCommandPalette: (handlers) => handlers.onCommandPalette(),
  onZoomIn: (handlers) => handlers.onZoomIn(),
  onZoomOut: (handlers) => handlers.onZoomOut(),
  onZoomReset: (handlers) => handlers.onZoomReset(),
  onGoBack: (handlers) => handlers.onGoBack?.(),
  onGoForward: (handlers) => handlers.onGoForward?.(),
  onOpenVault: (handlers) => handlers.onOpenVault?.(),
  onRemoveActiveVault: (handlers) => handlers.onRemoveActiveVault?.(),
  onRestoreGettingStarted: (handlers) => handlers.onRestoreGettingStarted?.(),
  onCommitPush: (handlers) => handlers.onCommitPush?.(),
  onPull: (handlers) => handlers.onPull?.(),
  onResolveConflicts: (handlers) => handlers.onResolveConflicts?.(),
  onViewChanges: (handlers) => handlers.onViewChanges?.(),
  onInstallMcp: (handlers) => handlers.onInstallMcp?.(),
  onReloadVault: (handlers) => handlers.onReloadVault?.(),
  onRepairVault: (handlers) => handlers.onRepairVault?.(),
  onOpenInNewWindow: (handlers) => handlers.onOpenInNewWindow?.(),
  onRestoreDeletedNote: (handlers) => handlers.onRestoreDeletedNote?.(),
}

const ACTIVE_TAB_HANDLER_EXECUTORS: Record<ActiveTabHandlerKey, (handlers: AppCommandHandlers, path: string) => void> = {
  onToggleOrganized: (handlers, path) => handlers.onToggleOrganized?.(path),
  onToggleFavorite: (handlers, path) => handlers.onToggleFavorite?.(path),
  onArchiveNote: (handlers, path) => handlers.onArchiveNote(path),
  onDeleteNote: (handlers, path) => handlers.onDeleteNote(path),
}

function dispatchActiveTabCommand(
  pathRef: MutableRefObject<string | null>,
  handler: (path: string) => void,
): boolean {
  const path = pathRef.current
  if (!path) return false
  handler(path)
  return true
}

function dispatchDefinition(
  definition: AppCommandDefinition,
  handlers: AppCommandHandlers,
): boolean {
  switch (definition.route.kind) {
    case 'view-mode':
      handlers.onSetViewMode(definition.route.value)
      return true
    case 'filter':
      handlers.onSelectFilter?.(definition.route.value)
      return true
    case 'handler':
      SIMPLE_HANDLER_EXECUTORS[definition.route.handler as SimpleHandlerKey](handlers)
      return true
    case 'active-tab-handler':
      return dispatchActiveTabCommand(
        handlers.activeTabPathRef,
        (path) => ACTIVE_TAB_HANDLER_EXECUTORS[definition.route.handler as ActiveTabHandlerKey](handlers, path),
      )
  }
}

export function dispatchAppCommand(id: AppCommandId, handlers: AppCommandHandlers): boolean {
  return dispatchDefinition(APP_COMMAND_DEFINITIONS[id], handlers)
}
