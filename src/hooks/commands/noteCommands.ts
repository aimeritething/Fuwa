import type { CommandAction } from './types'

interface NoteCommandsConfig {
  hasActiveNote: boolean
  activeTabPath: string | null
  isArchived: boolean
  activeNoteHasIcon?: boolean
  onCreateNote: () => void
  onCreateType?: () => void
  onOpenDailyNote: () => void
  onSave: () => void
  onDeleteNote: (path: string) => void
  onArchiveNote: (path: string) => void
  onUnarchiveNote: (path: string) => void
  onSetNoteIcon?: () => void
  onRemoveNoteIcon?: () => void
  onOpenInNewWindow?: () => void
  onToggleFavorite?: (path: string) => void
  isFavorite?: boolean
  onToggleOrganized?: (path: string) => void
  isOrganized?: boolean
  onRestoreDeletedNote?: () => void
  canRestoreDeletedNote?: boolean
}

export function buildNoteCommands(config: NoteCommandsConfig): CommandAction[] {
  const {
    hasActiveNote, activeTabPath, isArchived,
    onCreateNote, onCreateType, onOpenDailyNote, onSave,
    onDeleteNote, onArchiveNote, onUnarchiveNote,
    onSetNoteIcon, onRemoveNoteIcon, activeNoteHasIcon,
    onOpenInNewWindow, onToggleFavorite, isFavorite,
    onToggleOrganized, isOrganized,
    onRestoreDeletedNote, canRestoreDeletedNote,
  } = config

  return [
    { id: 'create-note', label: 'Create New Note', group: 'Note', shortcut: '⌘N', keywords: ['new', 'add'], enabled: true, execute: onCreateNote },
    { id: 'create-type', label: 'New Type', group: 'Note', keywords: ['new', 'create', 'type', 'template'], enabled: !!onCreateType, execute: () => onCreateType?.() },
    { id: 'open-daily-note', label: "Open Today's Note", group: 'Note', shortcut: '⌘J', keywords: ['daily', 'journal', 'today'], enabled: true, execute: onOpenDailyNote },
    { id: 'save-note', label: 'Save Note', group: 'Note', shortcut: '⌘S', keywords: ['write'], enabled: hasActiveNote, execute: onSave },
    {
      id: 'delete-note', label: 'Delete Note', group: 'Note', shortcut: '⌘⌫',
      keywords: ['delete', 'remove'], enabled: hasActiveNote,
      execute: () => { if (activeTabPath) onDeleteNote(activeTabPath) },
    },
    {
      id: 'archive-note', label: isArchived ? 'Unarchive Note' : 'Archive Note', group: 'Note',
      keywords: ['archive'], enabled: hasActiveNote,
      execute: () => { if (activeTabPath) (isArchived ? onUnarchiveNote : onArchiveNote)(activeTabPath) },
    },
    {
      id: 'restore-deleted-note', label: 'Restore Deleted Note', group: 'Note',
      keywords: ['restore', 'deleted', 'undelete', 'git', 'checkout'],
      enabled: !!canRestoreDeletedNote && !!onRestoreDeletedNote,
      execute: () => onRestoreDeletedNote?.(),
    },
    {
      id: 'toggle-favorite', label: isFavorite ? 'Remove from Favorites' : 'Add to Favorites', group: 'Note', shortcut: '⌘D',
      keywords: ['favorite', 'star', 'bookmark', 'pin'],
      enabled: hasActiveNote && !!onToggleFavorite,
      execute: () => { if (activeTabPath) onToggleFavorite?.(activeTabPath) },
    },
    {
      id: 'toggle-organized', label: isOrganized ? 'Mark as Unorganized' : 'Mark as Organized', group: 'Note', shortcut: '⌘E',
      keywords: ['organized', 'inbox', 'triage', 'done'],
      enabled: hasActiveNote && !!onToggleOrganized,
      execute: () => { if (activeTabPath) onToggleOrganized?.(activeTabPath) },
    },
    {
      id: 'set-note-icon', label: 'Set Note Icon', group: 'Note',
      keywords: ['icon', 'emoji', 'set', 'add', 'change', 'picker'],
      enabled: hasActiveNote && !!onSetNoteIcon,
      execute: () => onSetNoteIcon?.(),
    },
    {
      id: 'remove-note-icon', label: 'Remove Note Icon', group: 'Note',
      keywords: ['icon', 'emoji', 'remove', 'delete', 'clear'],
      enabled: hasActiveNote && !!activeNoteHasIcon && !!onRemoveNoteIcon,
      execute: () => onRemoveNoteIcon?.(),
    },
    {
      id: 'open-in-new-window', label: 'Open in New Window', group: 'Note', shortcut: '⌘⇧O',
      keywords: ['window', 'new', 'detach', 'pop', 'external', 'separate'],
      enabled: hasActiveNote,
      execute: () => onOpenInNewWindow?.(),
    },
  ]
}
