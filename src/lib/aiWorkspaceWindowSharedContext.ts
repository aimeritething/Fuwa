import type { AiWorkspaceWindowContext } from '../utils/openAiWorkspaceWindow'
import type { NoteListItem } from '../utils/ai-context'
import type { VaultEntry } from '../types'

const STORAGE_KEY = 'tolaria:ai-workspace-window-context:v1'
const BROADCAST_CHANNEL = 'tolaria-ai-workspace-window-context'

type Listener = () => void

export interface AiWorkspaceWindowSharedContext extends AiWorkspaceWindowContext {
  activeEntry?: VaultEntry | null
  activeNoteContent?: string | null
  entries?: VaultEntry[]
  noteList?: NoteListItem[]
  noteListFilter?: { type: string | null; query: string }
  openTabs?: VaultEntry[]
}

const EMPTY_CONTEXT: AiWorkspaceWindowSharedContext = {}

let context = readStoredContext()
let broadcastChannel: BroadcastChannel | null = null
const listeners = new Set<Listener>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isVaultEntry(value: unknown): value is VaultEntry {
  if (!isRecord(value)) return false
  return typeof value.path === 'string'
    && typeof value.filename === 'string'
    && typeof value.title === 'string'
    && Array.isArray(value.aliases)
}

function isNoteListItem(value: unknown): value is NoteListItem {
  if (!isRecord(value)) return false
  return typeof value.path === 'string'
    && typeof value.title === 'string'
    && typeof value.type === 'string'
}

function sanitizeEntries(value: unknown): VaultEntry[] | undefined {
  if (!Array.isArray(value)) return undefined
  const entries = value.filter(isVaultEntry)
  return entries.length > 0 ? entries : undefined
}

function sanitizeNoteList(value: unknown): NoteListItem[] | undefined {
  if (!Array.isArray(value)) return undefined
  const noteList = value.filter(isNoteListItem)
  return noteList.length > 0 ? noteList : undefined
}

function sanitizeContext(value: unknown): AiWorkspaceWindowSharedContext {
  if (!isRecord(value)) return EMPTY_CONTEXT
  const activeEntry = value.activeEntry === null || isVaultEntry(value.activeEntry)
    ? value.activeEntry
    : undefined
  const noteListFilter = isRecord(value.noteListFilter)
    ? {
      type: typeof value.noteListFilter.type === 'string' ? value.noteListFilter.type : null,
      query: typeof value.noteListFilter.query === 'string' ? value.noteListFilter.query : '',
    }
    : undefined

  return {
    activeConversationId: typeof value.activeConversationId === 'string' ? value.activeConversationId : undefined,
    activeEntry,
    activeNoteContent: typeof value.activeNoteContent === 'string' ? value.activeNoteContent : null,
    entries: sanitizeEntries(value.entries),
    noteList: sanitizeNoteList(value.noteList),
    noteListFilter,
    openTabs: sanitizeEntries(value.openTabs),
    vaultPath: typeof value.vaultPath === 'string' ? value.vaultPath : undefined,
    vaultPaths: Array.isArray(value.vaultPaths)
      ? value.vaultPaths.filter((item): item is string => typeof item === 'string')
      : undefined,
  }
}

function readStoredContext(): AiWorkspaceWindowSharedContext {
  if (typeof localStorage === 'undefined') return EMPTY_CONTEXT

  try {
    return sanitizeContext(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'))
  } catch {
    return EMPTY_CONTEXT
  }
}

function writeStoredContext(): void {
  if (typeof localStorage === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(context))
  } catch {
    // The AI window can still open without shared editor context.
  }
}

function notify(): void {
  for (const listener of listeners) listener()
}

function broadcast(): void {
  if (typeof BroadcastChannel === 'undefined') return

  broadcastChannel ??= new BroadcastChannel(BROADCAST_CHANNEL)
  broadcastChannel.postMessage({ type: 'ai-workspace-window-context-updated' })
}

function syncFromStorage(): void {
  context = readStoredContext()
  notify()
}

function ensureCrossWindowSync(): void {
  if (typeof window === 'undefined') return

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) syncFromStorage()
  })

  if (typeof BroadcastChannel === 'undefined') return
  broadcastChannel ??= new BroadcastChannel(BROADCAST_CHANNEL)
  broadcastChannel.onmessage = syncFromStorage
}

function cloneEntryForWindowContext(entry: VaultEntry): VaultEntry {
  return {
    ...entry,
    createdAt: entry.createdAt ?? null,
    modifiedAt: entry.modifiedAt ?? null,
    aliases: [...entry.aliases],
    belongsTo: [...entry.belongsTo],
    relatedTo: [...entry.relatedTo],
    outgoingLinks: [...entry.outgoingLinks],
    listPropertiesDisplay: [...entry.listPropertiesDisplay],
    properties: { ...entry.properties },
    relationships: Object.fromEntries(
      Object.entries(entry.relationships).map(([key, values]) => [key, [...values]]),
    ),
  }
}

function cloneContextForWindow(nextContext: AiWorkspaceWindowSharedContext): AiWorkspaceWindowSharedContext {
  return {
    ...nextContext,
    activeEntry: nextContext.activeEntry ? cloneEntryForWindowContext(nextContext.activeEntry) : nextContext.activeEntry,
    entries: nextContext.entries?.map(cloneEntryForWindowContext),
    openTabs: nextContext.openTabs?.map(cloneEntryForWindowContext),
    noteList: nextContext.noteList?.map((item) => ({ ...item })),
    noteListFilter: nextContext.noteListFilter ? { ...nextContext.noteListFilter } : nextContext.noteListFilter,
    vaultPaths: nextContext.vaultPaths ? [...nextContext.vaultPaths] : nextContext.vaultPaths,
  }
}

export function aiWorkspaceWindowSharedContextSnapshot(): AiWorkspaceWindowSharedContext {
  return context
}

export function subscribeAiWorkspaceWindowSharedContext(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function publishAiWorkspaceWindowSharedContext(nextContext: AiWorkspaceWindowSharedContext): void {
  context = cloneContextForWindow(nextContext)
  writeStoredContext()
  broadcast()
  notify()
}

ensureCrossWindowSync()
