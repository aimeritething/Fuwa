import type { CommandAction } from './types'

interface NoteCommandsConfig {
  hasActiveNote: boolean
  activeTabPath: string | null
  isArchived: boolean
  activeNoteHasIcon?: boolean
  onCreateNote: () => void
  onCreateType?: () => void
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

interface ActivePathCommandConfig {
  id: string
  label: string
  keywords: string[]
  enabled: boolean
  path: string | null
  shortcut?: string
  run: (path: string) => void
}

function createActivePathCommand(config: ActivePathCommandConfig): CommandAction {
  return {
    id: config.id,
    label: config.label,
    group: 'Note',
    shortcut: config.shortcut,
    keywords: config.keywords,
    enabled: config.enabled,
    execute: () => {
      if (config.path) config.run(config.path)
    },
  }
}

export function buildNoteCommands(config: NoteCommandsConfig): CommandAction[] {
  const {
    hasActiveNote, activeTabPath, isArchived,
    onCreateNote, onCreateType, onSave,
    onDeleteNote, onArchiveNote, onUnarchiveNote,
    onSetNoteIcon, onRemoveNoteIcon, activeNoteHasIcon,
    onOpenInNewWindow, onToggleFavorite, isFavorite,
    onToggleOrganized, isOrganized,
    onRestoreDeletedNote, canRestoreDeletedNote,
  } = config

  return [
    { id: 'create-note', label: 'New Note', group: 'Note', shortcut: '⌘N', keywords: ['new', 'create', 'add'], enabled: true, execute: onCreateNote },
    { id: 'create-type', label: 'New Type', group: 'Note', keywords: ['new', 'create', 'type', 'template'], enabled: !!onCreateType, execute: () => onCreateType?.() },
    { id: 'save-note', label: 'Save Note', group: 'Note', shortcut: '⌘S', keywords: ['write'], enabled: hasActiveNote, execute: onSave },
    createActivePathCommand({
      id: 'delete-note',
      label: 'Delete Note',
      shortcut: '⌘⌫',
      keywords: ['delete', 'remove'],
      enabled: hasActiveNote,
      path: activeTabPath,
      run: onDeleteNote,
    }),
    createActivePathCommand({
      id: 'archive-note',
      label: isArchived ? 'Unarchive Note' : 'Archive Note',
      keywords: ['archive'],
      enabled: hasActiveNote,
      path: activeTabPath,
      run: isArchived ? onUnarchiveNote : onArchiveNote,
    }),
    {
      id: 'restore-deleted-note', label: 'Restore Deleted Note', group: 'Note',
      keywords: ['restore', 'deleted', 'undelete', 'git', 'checkout'],
      enabled: !!canRestoreDeletedNote && !!onRestoreDeletedNote,
      execute: () => onRestoreDeletedNote?.(),
    },
    createActivePathCommand({
      id: 'toggle-favorite',
      label: isFavorite ? 'Remove from Favorites' : 'Add to Favorites',
      shortcut: '⌘D',
      keywords: ['favorite', 'star', 'bookmark', 'pin'],
      enabled: hasActiveNote && !!onToggleFavorite,
      path: activeTabPath,
      run: (path) => onToggleFavorite?.(path),
    }),
    createActivePathCommand({
      id: 'toggle-organized',
      label: isOrganized ? 'Mark as Unorganized' : 'Mark as Organized',
      shortcut: '⌘E',
      keywords: ['organized', 'inbox', 'triage', 'done'],
      enabled: hasActiveNote && !!onToggleOrganized,
      path: activeTabPath,
      run: (path) => onToggleOrganized?.(path),
    }),
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
