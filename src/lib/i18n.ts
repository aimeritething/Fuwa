/**
 * Fuwa ships one locale. This module keeps Tolaria's i18n module path and
 * export names so every call site (and the carried tests) resolve unchanged,
 * but the catalog is a single flat English map instead of 22 JSON locales.
 */

export const DEFAULT_APP_LOCALE = 'en'

export const APP_LOCALES = ['en'] as const

export type AppLocale = typeof APP_LOCALES[number]
export type TranslationValues = Record<string, string | number>

export const EN_TRANSLATIONS = {
  "command.git.commitPush": "Commit & Push",
  "command.git.pull": "Pull from Remote",
  "command.git.resolveConflicts": "Resolve Conflicts",
  "command.git.viewChanges": "View Pending Changes",
  "command.navigation.goBack": "Go Back",
  "command.navigation.goForward": "Go Forward",
  "command.note.archiveNote": "Archive Note",
  "command.note.deleteNote": "Delete Note",
  "command.note.exportPdf": "Export note as PDF",
  "command.note.findInNote": "Find in Note",
  "command.note.newNote": "New Note",
  "command.note.newType": "New Type",
  "command.note.openNewWindow": "Open in New Window",
  "command.note.redo": "Redo",
  "command.note.replaceInNote": "Replace in Note",
  "command.note.restoreDeleted": "Restore Deleted Note",
  "command.note.undo": "Undo",
  "command.settings.openVault": "Open Vault…",
  "command.settings.reloadVault": "Reload Vault",
  "command.settings.removeVault": "Remove Vault from List",
  "command.settings.repairVault": "Repair Vault",
  "command.settings.restoreGettingStarted": "Restore Getting Started Vault",
  "command.settings.setupExternalAi": "Set Up External AI Tools…",
  "command.view.editorNoteList": "Editor + Note List",
  "command.view.editorOnly": "Editor Only",
  "command.view.toggleAiPanel": "Toggle AI Panel",
  "command.view.toggleBacklinks": "Toggle Backlinks",
  "command.view.toggleDiff": "Toggle Diff Mode",
  "command.view.toggleProperties": "Toggle Properties Panel",
  "command.view.toggleRaw": "Toggle Raw Editor",
  "editor.blockType.bulletList": "Bullet List",
  "editor.blockType.checklist": "Checklist",
  "editor.blockType.codeBlock": "Code Block",
  "editor.blockType.heading1": "Heading 1",
  "editor.blockType.heading2": "Heading 2",
  "editor.blockType.heading3": "Heading 3",
  "editor.blockType.heading4": "Heading 4",
  "editor.blockType.heading5": "Heading 5",
  "editor.blockType.heading6": "Heading 6",
  "editor.blockType.numberedList": "Numbered List",
  "editor.blockType.paragraph": "Paragraph",
  "editor.blockType.quote": "Quote",
  "editor.callout.defaultHeading": "Note",
  "editor.codeBlock.copy": "Copy code to clipboard",
  "editor.empty.selectNote": "Select a note to start editing",
  "editor.empty.shortcuts": "{quickOpen} to search · {newNote} to create",
  "editor.find.close": "Close find",
  "editor.find.findLabel": "Find",
  "editor.find.findPlaceholder": "Find",
  "editor.find.hideReplace": "Hide replace",
  "editor.find.invalidRegex": "Invalid regex",
  "editor.find.matchCase": "Match case",
  "editor.find.matchCount": "{current} / {total}",
  "editor.find.nextMatch": "Next match",
  "editor.find.noMatches": "No matches",
  "editor.find.previousMatch": "Previous match",
  "editor.find.regex": "Use regular expression",
  "editor.find.regexMustMatchText": "Regex must match text",
  "editor.find.replace": "Replace",
  "editor.find.replaceAll": "All",
  "editor.find.replaceLabel": "Replace",
  "editor.find.replacePlaceholder": "Replace",
  "editor.find.showReplace": "Show replace",
  "editor.formatting.highlight": "Highlight",
  "editor.formatting.highlightBlue": "Blue",
  "editor.formatting.highlightChangeColor": "Change highlight color",
  "editor.formatting.highlightColor": "Choose highlight color",
  "editor.formatting.highlightGreen": "Green",
  "editor.formatting.highlightPurple": "Purple",
  "editor.formatting.highlightRed": "Red",
  "editor.formatting.highlightTooltip": "Highlight (persists in markdown)",
  "editor.formatting.highlightYellow": "Yellow",
  "editor.htmlBlock.blockedFallback": "This HTML was blocked by the sandbox rules.",
  "editor.htmlBlock.copySource": "Copy source",
  "editor.htmlBlock.openRawEditor": "Open raw editor",
  "editor.htmlBlock.previewTitle": "Sandboxed HTML block preview",
  "editor.htmlBlock.resetHeight": "Reset height",
  "editor.htmlBlock.resizeHeight": "Resize height",
  "editor.htmlBlock.toolbar": "HTML block actions",
  "editor.imageLightbox.title": "Image preview",
  "editor.sideMenu.collapseItem": "Collapse item",
  "editor.sideMenu.collapseSection": "Collapse section",
  "editor.sideMenu.expandItem": "Expand item",
  "editor.sideMenu.expandSection": "Expand section",
  "editor.sideMenu.turnIntoMenu": "Turn into...",
  "editor.slash.callout": "Callout",
  "editor.slash.callout.abstract": "Abstract",
  "editor.slash.callout.bug": "Bug",
  "editor.slash.callout.danger": "Danger",
  "editor.slash.callout.example": "Example",
  "editor.slash.callout.failure": "Failure",
  "editor.slash.callout.info": "Info",
  "editor.slash.callout.note": "Note",
  "editor.slash.callout.question": "Question",
  "editor.slash.callout.quote": "Quote",
  "editor.slash.callout.success": "Success",
  "editor.slash.callout.tip": "Tip",
  "editor.slash.callout.todo": "Todo",
  "editor.slash.callout.warning": "Warning",
  "editor.slash.date": "Date",
  "editor.slash.datetime": "Date and time",
  "editor.slash.htmlBlock": "HTML block",
  "editor.slash.math": "Math",
  "editor.slash.time": "Time",
  "editor.toolbar.rawOpen": "Open the raw editor",
  "editor.whiteboard.enterFullscreen": "Expand whiteboard",
  "editor.whiteboard.exitFullscreen": "Exit fullscreen whiteboard",
  "editor.whiteboard.permissionDeniedBody": "Tolaria could not use a desktop capability that this whiteboard needs. Allow the permission in your system settings, then reopen the note.",
  "editor.whiteboard.permissionDeniedTitle": "Whiteboard permission blocked",
  "fileActions.copied.filePath": "File path copied",
  "fileActions.copied.folderPath": "Folder path copied",
  "fileActions.error.copyFolderPath": "Failed to copy folder path: {detail}",
  "fileActions.error.copyPath": "Failed to copy path: {detail}",
  "fileActions.error.openFile": "Failed to open file: {detail}",
  "fileActions.error.pathMissing": "Path does not exist: {path}",
  "fileActions.error.revealPath": "Failed to reveal path: {detail}",
  "filePreview.copyDeepLink": "Copy link",
  "menu.edit": "Edit",
  "menu.edit.findInVault": "Find in Vault",
  "menu.edit.pasteWithoutFormatting": "Paste without Formatting",
  "menu.edit.toggleNoteListSearch": "Toggle Note List Search",
  "menu.file": "File",
  "menu.file.quickOpen": "Quick Open",
  "menu.file.quickOpenCmdO": "Quick Open (Cmd+O)",
  "menu.file.quickOpenCtrlO": "Quick Open (Ctrl+O)",
  "menu.file.save": "Save",
  "menu.go": "Go",
  "menu.go.allNotes": "All Notes",
  "menu.go.archived": "Archived",
  "menu.go.changes": "Changes",
  "menu.go.inbox": "Inbox",
  "menu.note": "Note",
  "menu.note.toggleOrganized": "Toggle Organized",
  "menu.note.toggleTableOfContents": "Toggle Table of Contents",
  "menu.vault": "Vault",
  "menu.vault.addRemote": "Add Remote…",
  "menu.view": "View",
  "menu.view.actualSize": "Actual Size",
  "menu.view.allPanels": "All Panels",
  "menu.view.commandPalette": "Command Palette",
  "menu.view.zoomIn": "Zoom In",
  "menu.view.zoomOut": "Zoom Out",
  "menu.window": "Window",
  "save.error.failed": "Save failed: {error}",
  "save.error.invalidPath": "Save failed: The note path is invalid on this platform. Rename the note or move it to a valid folder, then try again.",
  "save.toast.missingActiveVault": "Select or restore a vault before saving.",
  "save.toast.nothingToSave": "Nothing to save",
  "save.toast.saved": "Saved",
  "sidebar.action.copyFolderPathMenu": "Copy folder path",
  "sidebar.action.createFolder": "Create folder",
  "sidebar.action.createFolderInFolderMenu": "Create a new folder in this folder",
  "sidebar.action.createNoteInFolderMenu": "Create a new note in this folder",
  "sidebar.action.deleteFolderMenu": "Delete folder...",
  "sidebar.action.renameFolderMenu": "Rename folder...",
  "sidebar.action.revealFolderMenu": "Reveal in Finder",
  "sidebar.folder.name": "Folder name",
  "sidebar.folder.newName": "New folder name",
  "sidebar.group.folders": "FOLDERS",
  "status.vault.default": "Vault",
} as const

export type TranslationCatalog = typeof EN_TRANSLATIONS
export type TranslationKey = keyof TranslationCatalog

export function interpolate(template: string, values: TranslationValues = {}): string {
  const interpolationValues = new Map(Object.entries(values))
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = interpolationValues.get(key)
    return value === undefined ? match : String(value)
  })
}

export function translate(_locale: AppLocale, key: TranslationKey, values?: TranslationValues): string {
  return interpolate(Reflect.get(EN_TRANSLATIONS, key) as string, values)
}

export function createTranslator(locale: AppLocale = DEFAULT_APP_LOCALE) {
  return (key: TranslationKey, values?: TranslationValues) => translate(locale, key, values)
}

export function resolveEffectiveLocale(
  preference?: unknown,
  languagePreferences?: readonly string[],
): AppLocale {
  void preference
  void languagePreferences
  return DEFAULT_APP_LOCALE
}
