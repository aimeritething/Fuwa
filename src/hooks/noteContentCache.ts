import type { VaultEntry } from '../types'

/**
 * Fuwa's note-content event bus. Tolaria caches note content in an LRU and
 * emits a "resolved" event whenever an entry lands; Fuwa keeps only the event,
 * which is what the parsed-block preload listens to. The shell fires it for the
 * active Tab.
 */

export interface NoteContentIdentity {
  modifiedAt: number | null
  fileSize: number | null
}

export interface NoteContentResolvedEvent {
  entry: VaultEntry | null
  path: string
  content: string
  parsedBlockPreload: boolean
}

export interface NoteContentRequestOptions {
  parsedBlockPreload?: boolean
}

type NoteContentResolvedListener = (event: NoteContentResolvedEvent) => void

const resolvedListeners = new Set<NoteContentResolvedListener>()

export function subscribeNoteContentResolved(listener: NoteContentResolvedListener): () => void {
  resolvedListeners.add(listener)
  return () => {
    resolvedListeners.delete(listener)
  }
}

export function cacheNoteContent(
  path: string,
  content: string,
  entry?: VaultEntry,
  options?: NoteContentRequestOptions,
): void {
  const event: NoteContentResolvedEvent = {
    entry: entry ?? null,
    path,
    content,
    parsedBlockPreload: options?.parsedBlockPreload ?? true,
  }
  for (const listener of resolvedListeners) {
    try {
      listener(event)
    } catch (error) {
      console.warn('Note content listener failed:', error)
    }
  }
}
