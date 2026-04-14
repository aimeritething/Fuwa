import { useCallback, useRef } from 'react'
import type { AiAgentId, AiAgentsStatus } from '../lib/aiAgents'
import type { VaultAiGuidanceStatus } from '../lib/vaultAiGuidance'
import { useAppKeyboard } from './useAppKeyboard'
import { useCommandRegistry } from './useCommandRegistry'
import type { CommandAction } from './useCommandRegistry'
import { useKeyboardNavigation } from './useKeyboardNavigation'
import { useMenuEvents } from './useMenuEvents'
import type { SidebarSelection, SidebarFilter, VaultEntry } from '../types'
import type { NoteListFilter } from '../utils/noteListHelpers'
import type { ViewMode } from './useViewMode'

interface AppCommandsConfig {
  activeTabPath: string | null
  activeTabPathRef: React.MutableRefObject<string | null>
  entries: VaultEntry[]
  visibleNotesRef: React.RefObject<VaultEntry[]>
  modifiedCount: number
  selection: SidebarSelection
  onQuickOpen: () => void
  onCommandPalette: () => void
  onSearch: () => void
  onCreateNote: () => void
  onCreateNoteOfType: (type: string) => void
  onSave: () => void
  onOpenSettings: () => void
  onOpenFeedback?: () => void
  onDeleteNote: (path: string) => void
  onArchiveNote: (path: string) => void
  onUnarchiveNote: (path: string) => void
  onCommitPush: () => void
  onPull?: () => void
  onResolveConflicts?: () => void
  onSetViewMode: (mode: ViewMode) => void
  onToggleInspector: () => void
  onToggleDiff?: () => void
  onToggleRawEditor?: () => void
  activeNoteModified: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  zoomLevel: number
  onSelect: (sel: SidebarSelection) => void
  showInbox?: boolean
  onReplaceActiveTab: (entry: VaultEntry) => void
  onSelectNote: (entry: VaultEntry) => void
  onGoBack?: () => void
  onGoForward?: () => void
  canGoBack?: boolean
  canGoForward?: boolean
  onOpenVault?: () => void
  onCreateType?: () => void
  onToggleAIChat?: () => void
  onCheckForUpdates?: () => void
  onRemoveActiveVault?: () => void
  onRestoreGettingStarted?: () => void
  isGettingStartedHidden?: boolean
  vaultCount?: number
  mcpStatus?: string
  onInstallMcp?: () => void
  aiAgentsStatus?: AiAgentsStatus
  vaultAiGuidanceStatus?: VaultAiGuidanceStatus
  onOpenAiAgents?: () => void
  onRestoreVaultAiGuidance?: () => void
  onSetDefaultAiAgent?: (agent: AiAgentId) => void
  selectedAiAgent?: AiAgentId
  onCycleDefaultAiAgent?: () => void
  selectedAiAgentLabel?: string
  claudeCodeStatus?: string
  claudeCodeVersion?: string
  onReloadVault?: () => void
  onRepairVault?: () => void
  onSetNoteIcon?: () => void
  onRemoveNoteIcon?: () => void
  activeNoteHasIcon?: boolean
  noteListFilter?: NoteListFilter
  onSetNoteListFilter?: (filter: NoteListFilter) => void
  onOpenInNewWindow?: () => void
  onToggleFavorite?: (path: string) => void
  onToggleOrganized?: (path: string) => void
  onCustomizeInboxColumns?: () => void
  canCustomizeInboxColumns?: boolean
  onRestoreDeletedNote?: () => void
  canRestoreDeletedNote?: boolean
}

function createKeyboardActions(
  config: AppCommandsConfig,
): Omit<Parameters<typeof useAppKeyboard>[0], 'onArchiveNote'> {
  return {
    onQuickOpen: config.onQuickOpen,
    onCommandPalette: config.onCommandPalette,
    onSearch: config.onSearch,
    onCreateNote: config.onCreateNote,
    onSave: config.onSave,
    onOpenSettings: config.onOpenSettings,
    onDeleteNote: config.onDeleteNote,
    onSetViewMode: config.onSetViewMode,
    onZoomIn: config.onZoomIn,
    onZoomOut: config.onZoomOut,
    onZoomReset: config.onZoomReset,
    onGoBack: config.onGoBack,
    onGoForward: config.onGoForward,
    onToggleAIChat: config.onToggleAIChat,
    onToggleRawEditor: config.onToggleRawEditor,
    onToggleInspector: config.onToggleInspector,
    onToggleFavorite: config.onToggleFavorite,
    onToggleOrganized: config.onToggleOrganized,
    onOpenInNewWindow: config.onOpenInNewWindow,
    activeTabPathRef: config.activeTabPathRef,
  }
}

function createMenuEventHandlers(
  config: AppCommandsConfig,
  selectFilter: (filter: SidebarFilter) => void,
  viewChanges: () => void,
): Omit<Parameters<typeof useMenuEvents>[0], 'onArchiveNote'> {
  return {
    onSetViewMode: config.onSetViewMode,
    onCreateNote: config.onCreateNote,
    onCreateType: config.onCreateType,
    onQuickOpen: config.onQuickOpen,
    onSave: config.onSave,
    onOpenSettings: config.onOpenSettings,
    onToggleInspector: config.onToggleInspector,
    onCommandPalette: config.onCommandPalette,
    onZoomIn: config.onZoomIn,
    onZoomOut: config.onZoomOut,
    onZoomReset: config.onZoomReset,
    onDeleteNote: config.onDeleteNote,
    onSearch: config.onSearch,
    onToggleRawEditor: config.onToggleRawEditor,
    onToggleDiff: config.onToggleDiff,
    onToggleAIChat: config.onToggleAIChat,
    onToggleOrganized: config.onToggleOrganized,
    onGoBack: config.onGoBack,
    onGoForward: config.onGoForward,
    onCheckForUpdates: config.onCheckForUpdates,
    onSelectFilter: selectFilter,
    onOpenVault: config.onOpenVault,
    onRemoveActiveVault: config.onRemoveActiveVault,
    onRestoreGettingStarted: config.onRestoreGettingStarted,
    onCommitPush: config.onCommitPush,
    onPull: config.onPull,
    onResolveConflicts: config.onResolveConflicts,
    onViewChanges: viewChanges,
    onInstallMcp: config.onInstallMcp,
    onReloadVault: config.onReloadVault,
    onRepairVault: config.onRepairVault,
    onOpenInNewWindow: config.onOpenInNewWindow,
    onRestoreDeletedNote: config.onRestoreDeletedNote,
    activeTabPathRef: config.activeTabPathRef,
    activeTabPath: config.activeTabPath,
    modifiedCount: config.modifiedCount,
    hasRestorableDeletedNote: config.canRestoreDeletedNote,
  }
}

function createCommandRegistryConfig(config: AppCommandsConfig): Parameters<typeof useCommandRegistry>[0] {
  return {
    activeTabPath: config.activeTabPath,
    entries: config.entries,
    modifiedCount: config.modifiedCount,
    onQuickOpen: config.onQuickOpen,
    onCreateNote: config.onCreateNote,
    onCreateNoteOfType: config.onCreateNoteOfType,
    onSave: config.onSave,
    onOpenSettings: config.onOpenSettings,
    onOpenFeedback: config.onOpenFeedback,
    onDeleteNote: config.onDeleteNote,
    onArchiveNote: config.onArchiveNote,
    onUnarchiveNote: config.onUnarchiveNote,
    onCommitPush: config.onCommitPush,
    onPull: config.onPull,
    onResolveConflicts: config.onResolveConflicts,
    onSetViewMode: config.onSetViewMode,
    onToggleInspector: config.onToggleInspector,
    onToggleDiff: config.onToggleDiff,
    onToggleRawEditor: config.onToggleRawEditor,
    onToggleAIChat: config.onToggleAIChat,
    onOpenVault: config.onOpenVault,
    activeNoteModified: config.activeNoteModified,
    onZoomIn: config.onZoomIn,
    onZoomOut: config.onZoomOut,
    onZoomReset: config.onZoomReset,
    zoomLevel: config.zoomLevel,
    onSelect: config.onSelect,
    showInbox: config.showInbox,
    onGoBack: config.onGoBack,
    onGoForward: config.onGoForward,
    canGoBack: config.canGoBack,
    canGoForward: config.canGoForward,
    onCheckForUpdates: config.onCheckForUpdates,
    onCreateType: config.onCreateType,
    onRemoveActiveVault: config.onRemoveActiveVault,
    onRestoreGettingStarted: config.onRestoreGettingStarted,
    isGettingStartedHidden: config.isGettingStartedHidden,
    vaultCount: config.vaultCount,
    mcpStatus: config.mcpStatus,
    onInstallMcp: config.onInstallMcp,
    aiAgentsStatus: config.aiAgentsStatus,
    vaultAiGuidanceStatus: config.vaultAiGuidanceStatus,
    onOpenAiAgents: config.onOpenAiAgents,
    onRestoreVaultAiGuidance: config.onRestoreVaultAiGuidance,
    onSetDefaultAiAgent: config.onSetDefaultAiAgent,
    selectedAiAgent: config.selectedAiAgent,
    onCycleDefaultAiAgent: config.onCycleDefaultAiAgent,
    selectedAiAgentLabel: config.selectedAiAgentLabel,
    onReloadVault: config.onReloadVault,
    onRepairVault: config.onRepairVault,
    onSetNoteIcon: config.onSetNoteIcon,
    onRemoveNoteIcon: config.onRemoveNoteIcon,
    activeNoteHasIcon: config.activeNoteHasIcon,
    selection: config.selection,
    noteListFilter: config.noteListFilter,
    onSetNoteListFilter: config.onSetNoteListFilter,
    onOpenInNewWindow: config.onOpenInNewWindow,
    onToggleFavorite: config.onToggleFavorite,
    onToggleOrganized: config.onToggleOrganized,
    onCustomizeInboxColumns: config.onCustomizeInboxColumns,
    canCustomizeInboxColumns: config.canCustomizeInboxColumns,
    onRestoreDeletedNote: config.onRestoreDeletedNote,
    canRestoreDeletedNote: config.canRestoreDeletedNote,
  }
}

/** Sets up keyboard shortcuts, command registry, menu events, and keyboard navigation. */
export function useAppCommands(config: AppCommandsConfig): CommandAction[] {
  const entriesRef = useRef(config.entries)
  // eslint-disable-next-line react-hooks/refs
  entriesRef.current = config.entries

  const toggleArchive = useCallback((path: string) => {
    const entry = entriesRef.current.find(e => e.path === path)
    ;(entry?.archived ? config.onUnarchiveNote : config.onArchiveNote)(path)
  }, [config.onArchiveNote, config.onUnarchiveNote])


  const { onSelect } = config

  const selectFilter = useCallback((filter: SidebarFilter) => {
    const safeFilter = !config.showInbox && filter === 'inbox' ? 'all' : filter
    onSelect({ kind: 'filter', filter: safeFilter })
  }, [config.showInbox, onSelect])

  const viewChanges = useCallback(() => {
    onSelect({ kind: 'filter', filter: 'changes' })
  }, [onSelect])

  const keyboardActions = createKeyboardActions(config)
  const menuEventHandlers = createMenuEventHandlers(config, selectFilter, viewChanges)

  useAppKeyboard({ ...keyboardActions, onArchiveNote: toggleArchive })

  useMenuEvents({ ...menuEventHandlers, onArchiveNote: toggleArchive })

  const commands = useCommandRegistry(createCommandRegistryConfig(config))

  useKeyboardNavigation({
    activeTabPath: config.activeTabPath,
    visibleNotesRef: config.visibleNotesRef,
    onReplaceActiveTab: config.onReplaceActiveTab,
    onSelectNote: config.onSelectNote,
  })

  return commands
}
