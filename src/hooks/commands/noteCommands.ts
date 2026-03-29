import type { CommandAction } from './types'

interface NoteCommandsConfig {
  hasActiveNote: boolean
  activeTabPath: string | null
  isArchived: boolean
  isTrashed: boolean
  activeNoteHasIcon?: boolean
  trashedCount?: number
  onCreateNote: () => void
  onCreateType?: () => void
  onOpenDailyNote: () => void
  onSave: () => void
  onTrashNote: (path: string) => void
  onRestoreNote: (path: string) => void
  onArchiveNote: (path: string) => void
  onUnarchiveNote: (path: string) => void
  onEmptyTrash?: () => void
  onSetNoteIcon?: () => void
  onRemoveNoteIcon?: () => void
  onOpenInNewWindow?: () => void
}

export function buildNoteCommands(config: NoteCommandsConfig): CommandAction[] {
  const {
    hasActiveNote, activeTabPath, isArchived, isTrashed,
    onCreateNote, onCreateType, onOpenDailyNote, onSave,
    onTrashNote, onRestoreNote, onArchiveNote, onUnarchiveNote,
    onEmptyTrash, trashedCount,
    onSetNoteIcon, onRemoveNoteIcon, activeNoteHasIcon,
    onOpenInNewWindow,
  } = config

  return [
    { id: 'create-note', label: 'Create New Note', group: 'Note', shortcut: '⌘N', keywords: ['new', 'add'], enabled: true, execute: onCreateNote },
    { id: 'create-type', label: 'New Type', group: 'Note', keywords: ['new', 'create', 'type', 'template'], enabled: !!onCreateType, execute: () => onCreateType?.() },
    { id: 'open-daily-note', label: "Open Today's Note", group: 'Note', shortcut: '⌘J', keywords: ['daily', 'journal', 'today'], enabled: true, execute: onOpenDailyNote },
    { id: 'save-note', label: 'Save Note', group: 'Note', shortcut: '⌘S', keywords: ['write'], enabled: hasActiveNote, execute: onSave },
    { id: 'empty-trash', label: 'Empty Trash', group: 'Note', keywords: ['delete', 'permanently', 'purge', 'clear', 'trash'], enabled: (trashedCount ?? 0) > 0, execute: () => onEmptyTrash?.() },
    {
      id: 'trash-note', label: isTrashed ? 'Restore Note' : 'Trash Note', group: 'Note', shortcut: '⌘⌫',
      keywords: ['delete', 'remove', 'restore', 'trash'], enabled: hasActiveNote,
      execute: () => { if (activeTabPath) (isTrashed ? onRestoreNote : onTrashNote)(activeTabPath) },
    },
    {
      id: 'archive-note', label: isArchived ? 'Unarchive Note' : 'Archive Note', group: 'Note', shortcut: '⌘E',
      keywords: ['archive'], enabled: hasActiveNote,
      execute: () => { if (activeTabPath) (isArchived ? onUnarchiveNote : onArchiveNote)(activeTabPath) },
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
