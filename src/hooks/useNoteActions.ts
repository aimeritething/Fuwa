import { useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '../mock-tauri'
import type { VaultEntry } from '../types'
import type { FrontmatterValue } from '../components/Inspector'
import { useTabManagement } from './useTabManagement'
import { updateMockFrontmatter, deleteMockFrontmatterProperty } from './mockFrontmatterHelpers'
import { updateMockContent, trackMockChange } from '../mock-tauri'
import { resolveEntry } from '../utils/wikilink'
import { useNoteCreation } from './useNoteCreation'
import {
  useNoteRename,
  performRename, loadNoteContent, renameToastMessage, reloadTabsAfterRename,
} from './useNoteRename'

// Re-export pure functions so existing consumers don't need to change imports.
export { buildNewEntry, slugify, generateUntitledName, entryMatchesTarget } from './useNoteCreation'
export { buildNoteContent, resolveNewNote, resolveNewType, resolveTemplate, DEFAULT_TEMPLATES } from './useNoteCreation'
export { todayDateString, buildDailyNoteContent, resolveDailyNote, findDailyNote } from './useNoteCreation'
export { needsRenameOnSave } from './useNoteRename'
export type { NewEntryParams } from './useNoteCreation'

export interface NoteActionsConfig {
  addEntry: (entry: VaultEntry) => void
  removeEntry: (path: string) => void
  entries: VaultEntry[]
  setToastMessage: (msg: string | null) => void
  updateEntry: (path: string, patch: Partial<VaultEntry>) => void
  vaultPath: string
  addPendingSave?: (path: string) => void
  removePendingSave?: (path: string) => void
  trackUnsaved?: (path: string) => void
  clearUnsaved?: (path: string) => void
  unsavedPaths?: Set<string>
  markContentPending?: (path: string, content: string) => void
  onNewNotePersisted?: () => void
  replaceEntry?: (oldPath: string, patch: Partial<VaultEntry> & { path: string }) => void
}

/** Check if a frontmatter key represents the note title. */
function isTitleKey(key: string): boolean {
  return key.toLowerCase().replace(/\s+/g, '_') === 'title'
}

const ENTRY_DELETE_MAP: Record<string, Partial<VaultEntry>> = {
  type: { isA: null }, is_a: { isA: null }, status: { status: null }, color: { color: null },
  icon: { icon: null }, owner: { owner: null }, cadence: { cadence: null },
  aliases: { aliases: [] }, belongs_to: { belongsTo: [] }, related_to: { relatedTo: [] },
  archived: { archived: false }, trashed: { trashed: false }, order: { order: null },
  template: { template: null }, sort: { sort: null }, visible: { visible: null },
}

/** Map a frontmatter key+value to the corresponding VaultEntry field(s). */
export function frontmatterToEntryPatch(
  op: 'update' | 'delete', key: string, value?: FrontmatterValue,
): Partial<VaultEntry> {
  const k = key.toLowerCase().replace(/\s+/g, '_')
  if (op === 'delete') return ENTRY_DELETE_MAP[k] ?? {}
  const str = value != null ? String(value) : null
  const arr = Array.isArray(value) ? value.map(String) : []
  const updates: Record<string, Partial<VaultEntry>> = {
    type: { isA: str }, is_a: { isA: str }, status: { status: str }, color: { color: str },
    icon: { icon: str }, owner: { owner: str }, cadence: { cadence: str },
    aliases: { aliases: arr }, belongs_to: { belongsTo: arr }, related_to: { relatedTo: arr },
    archived: { archived: Boolean(value) }, trashed: { trashed: Boolean(value) },
    order: { order: typeof value === 'number' ? value : null },
    template: { template: str },
    sort: { sort: str },
    view: { view: str },
    visible: { visible: value === false ? false : null },
  }
  return updates[k] ?? {}
}

async function invokeFrontmatter(command: string, args: Record<string, unknown>): Promise<string> {
  return invoke<string>(command, args)
}

function applyMockFrontmatterUpdate(path: string, key: string, value: FrontmatterValue): string {
  const content = updateMockFrontmatter(path, key, value)
  updateMockContent(path, content)
  trackMockChange(path)
  return content
}

function applyMockFrontmatterDelete(path: string, key: string): string {
  const content = deleteMockFrontmatterProperty(path, key)
  updateMockContent(path, content)
  trackMockChange(path)
  return content
}

async function executeFrontmatterOp(op: 'update' | 'delete', path: string, key: string, value?: FrontmatterValue): Promise<string> {
  if (op === 'update') {
    return isTauri() ? invokeFrontmatter('update_frontmatter', { path, key, value }) : applyMockFrontmatterUpdate(path, key, value!)
  }
  return isTauri() ? invokeFrontmatter('delete_frontmatter_property', { path, key }) : applyMockFrontmatterDelete(path, key)
}

/** Run a frontmatter update/delete and apply the result to state. */
async function runFrontmatterAndApply(
  op: 'update' | 'delete', path: string, key: string, value: FrontmatterValue | undefined,
  callbacks: { updateTab: (p: string, c: string) => void; updateEntry: (p: string, patch: Partial<VaultEntry>) => void; toast: (m: string | null) => void },
): Promise<void> {
  try {
    callbacks.updateTab(path, await executeFrontmatterOp(op, path, key, value))
    const patch = frontmatterToEntryPatch(op, key, value)
    if (Object.keys(patch).length > 0) callbacks.updateEntry(path, patch)
    callbacks.toast(op === 'update' ? 'Property updated' : 'Property deleted')
  } catch (err) {
    console.error(`Failed to ${op} frontmatter:`, err)
    callbacks.toast(`Failed to ${op} property`)
  }
}

interface TitleRenameDeps {
  vaultPath: string
  tabsRef: React.MutableRefObject<{ entry: VaultEntry; content: string }[]>
  replaceEntry?: (oldPath: string, patch: Partial<VaultEntry> & { path: string }) => void
  setTabs: React.Dispatch<React.SetStateAction<{ entry: VaultEntry; content: string }[]>>
  activeTabPathRef: React.MutableRefObject<string | null>
  handleSwitchTab: (path: string) => void
  setToastMessage: (msg: string | null) => void
  updateTabContent: (path: string, content: string) => void
}

/** After a frontmatter title change, rename the file and update all tabs. */
async function renameAfterTitleChange(path: string, newTitle: string, deps: TitleRenameDeps): Promise<void> {
  const oldTitle = deps.tabsRef.current.find(t => t.entry.path === path)?.entry.title
  const result = await performRename(path, newTitle, deps.vaultPath, oldTitle)
  if (result.new_path !== path) {
    const newFilename = result.new_path.split('/').pop() ?? ''
    deps.replaceEntry?.(path, { path: result.new_path, filename: newFilename, title: newTitle } as Partial<VaultEntry> & { path: string })
    const newContent = await loadNoteContent(result.new_path)
    deps.setTabs(prev => prev.map(t => t.entry.path === path
      ? { entry: { ...t.entry, path: result.new_path, filename: newFilename, title: newTitle }, content: newContent }
      : t))
    if (deps.activeTabPathRef.current === path) deps.handleSwitchTab(result.new_path)
    const otherTabPaths = deps.tabsRef.current.filter(t => t.entry.path !== path && t.entry.path !== result.new_path).map(t => t.entry.path)
    await reloadTabsAfterRename(otherTabPaths, deps.updateTabContent)
  }
  deps.setToastMessage(renameToastMessage(result.updated_files))
}

function shouldRenameOnTitleUpdate(key: string, value: FrontmatterValue): value is string {
  return isTitleKey(key) && typeof value === 'string' && value !== ''
}

function findWikilinkTarget(entries: VaultEntry[], target: string): VaultEntry | undefined {
  return resolveEntry(entries, target)
}

/** Navigate to a wikilink target, logging a warning if not found. */
function navigateWikilink(entries: VaultEntry[], target: string, selectNote: (e: VaultEntry) => void): void {
  const found = findWikilinkTarget(entries, target)
  if (found) selectNote(found)
  else console.warn(`Navigation target not found: ${target}`)
}

export function useNoteActions(config: NoteActionsConfig) {
  const { entries, setToastMessage, updateEntry } = config
  const tabMgmt = useTabManagement()
  const { setTabs, handleSelectNote, openTabWithContent, handleCloseTab, handleCloseTabRef, activeTabPathRef, handleSwitchTab } = tabMgmt

  const updateTabContent = useCallback((path: string, newContent: string) => {
    setTabs((prev) => prev.map((t) => t.entry.path === path ? { ...t, content: newContent } : t))
  }, [setTabs])

  const creation = useNoteCreation(config, { openTabWithContent, handleSelectNote, handleCloseTab, handleCloseTabRef })
  const rename = useNoteRename(
    { entries, setToastMessage },
    { tabs: tabMgmt.tabs, setTabs, activeTabPathRef, handleSwitchTab, updateTabContent },
  )

  const handleNavigateWikilink = useCallback(
    (target: string) => navigateWikilink(entries, target, handleSelectNote),
    [entries, handleSelectNote],
  )

  const runFrontmatterOp = useCallback(
    (op: 'update' | 'delete', path: string, key: string, value?: FrontmatterValue) =>
      runFrontmatterAndApply(op, path, key, value, { updateTab: updateTabContent, updateEntry, toast: setToastMessage }),
    [updateTabContent, updateEntry, setToastMessage],
  )

  return {
    ...tabMgmt,
    handleCloseTab: creation.handleCloseTabWithCleanup,
    handleNavigateWikilink,
    handleCreateNote: creation.handleCreateNote,
    handleCreateNoteImmediate: creation.handleCreateNoteImmediate,
    handleCreateNoteForRelationship: creation.handleCreateNoteForRelationship,
    handleOpenDailyNote: creation.handleOpenDailyNote,
    handleCreateType: creation.handleCreateType,
    createTypeEntrySilent: creation.createTypeEntrySilent,
    handleUpdateFrontmatter: useCallback(async (path: string, key: string, value: FrontmatterValue) => {
      await runFrontmatterOp('update', path, key, value)
      if (shouldRenameOnTitleUpdate(key, value)) {
        try {
          await renameAfterTitleChange(path, value, {
            vaultPath: config.vaultPath, tabsRef: rename.tabsRef, replaceEntry: config.replaceEntry,
            setTabs, activeTabPathRef, handleSwitchTab, setToastMessage, updateTabContent,
          })
        } catch (err) {
          console.error('Failed to rename note after title change:', err)
        }
      }
    }, [runFrontmatterOp, config.vaultPath, config.replaceEntry, rename.tabsRef, setTabs, activeTabPathRef, handleSwitchTab, setToastMessage, updateTabContent]),
    handleDeleteProperty: useCallback((path: string, key: string) => runFrontmatterOp('delete', path, key), [runFrontmatterOp]),
    handleAddProperty: useCallback((path: string, key: string, value: FrontmatterValue) => runFrontmatterOp('update', path, key, value), [runFrontmatterOp]),
    handleRenameNote: rename.handleRenameNote,
  }
}
