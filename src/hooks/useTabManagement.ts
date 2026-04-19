import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { VaultEntry } from '../types'

interface Tab {
  entry: VaultEntry
  content: string
}

type NotePath = VaultEntry['path']

// --- Content prefetch cache ---
// Stores in-flight or recently loaded note content promises, keyed by path.
// Cleared on vault reload to prevent stale content after external edits.
// Latency profile: deduplicates rapid note switches and keeps revisits instant.
interface NoteContentCacheEntry {
  path: NotePath
  promise: Promise<string>
  value: string | null
}

const prefetchCache = new Map<string, NoteContentCacheEntry>()
const NOTE_CONTENT_CACHE_LIMIT = 48

function trimPrefetchCache(): void {
  while (prefetchCache.size > NOTE_CONTENT_CACHE_LIMIT) {
    const oldestPath = prefetchCache.keys().next().value
    if (!oldestPath) return
    prefetchCache.delete(oldestPath)
  }
}

function rememberNoteContent(entry: NoteContentCacheEntry): NoteContentCacheEntry {
  const { path } = entry
  if (prefetchCache.has(path)) prefetchCache.delete(path)
  prefetchCache.set(path, entry)
  trimPrefetchCache()
  return entry
}

function requestNoteContent({ path }: Pick<NoteContentCacheEntry, 'path'>): NoteContentCacheEntry {
  const cacheEntry: NoteContentCacheEntry = {
    path,
    promise: Promise.resolve(''),
    value: null,
  }
  const promise = (isTauri()
    ? invoke<string>('get_note_content', { path })
    : mockInvoke<string>('get_note_content', { path })
  )
    .then((content) => {
      cacheEntry.value = content
      return content
    })
    .catch((err) => {
      prefetchCache.delete(path)
      throw err
    })

  cacheEntry.promise = promise
  return rememberNoteContent(cacheEntry)
}

/** Prefetch a note's content into the in-memory cache.
 *  Safe to call multiple times — deduplicates concurrent requests for the same path.
 *  Cache is short-lived: cleared on vault reload via clearPrefetchCache(). */
export function prefetchNoteContent(path: string): void {
  if (prefetchCache.has(path)) return
  requestNoteContent({ path })
}

export function cacheNoteContent(path: string, content: string): void {
  rememberNoteContent({
    path,
    promise: Promise.resolve(content),
    value: content,
  })
}

/** Clear the prefetch cache. Call on vault reload to prevent stale content. */
export function clearPrefetchCache(): void {
  prefetchCache.clear()
}

function getCachedNoteContent(path: string): string | null {
  return prefetchCache.get(path)?.value ?? null
}

async function loadNoteContent(path: string): Promise<string> {
  return prefetchCache.get(path)?.promise ?? requestNoteContent({ path }).promise
}

export type { Tab }

interface TabManagementOptions {
  beforeNavigate?: (fromPath: string, toPath: string) => Promise<void>
}

function syncActiveTabPath(
  activeTabPathRef: React.MutableRefObject<string | null>,
  setActiveTabPath: React.Dispatch<React.SetStateAction<string | null>>,
  path: string | null,
) {
  activeTabPathRef.current = path
  setActiveTabPath(path)
}

function setSingleTab(
  tabsRef: React.MutableRefObject<Tab[]>,
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>,
  nextTab: Tab,
) {
  tabsRef.current = [nextTab]
  setTabs([nextTab])
}

function isAlreadyViewingPath(
  tabsRef: React.MutableRefObject<Tab[]>,
  activeTabPathRef: React.MutableRefObject<string | null>,
  path: string,
) {
  return activeTabPathRef.current === path || tabsRef.current.some((tab) => tab.entry.path === path)
}

function startEntryNavigation(options: {
  entry: VaultEntry
  navSeqRef: React.MutableRefObject<number>
  tabsRef: React.MutableRefObject<Tab[]>
  activeTabPathRef: React.MutableRefObject<string | null>
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>
  setActiveTabPath: React.Dispatch<React.SetStateAction<string | null>>
}) {
  const {
    entry,
    navSeqRef,
    tabsRef,
    activeTabPathRef,
    setTabs,
    setActiveTabPath,
  } = options

  const seq = ++navSeqRef.current
  const cachedContent = getCachedNoteContent(entry.path)
  syncActiveTabPath(activeTabPathRef, setActiveTabPath, entry.path)
  if (cachedContent !== null) {
    setSingleTab(tabsRef, setTabs, { entry, content: cachedContent })
  }

  return { seq, cachedContent }
}

function shouldApplyLoadedEntry(options: {
  seq: number
  navSeqRef: React.MutableRefObject<number>
  cachedContent: string | null
  content: string
  activeTabPathRef: React.MutableRefObject<string | null>
  path: string
}) {
  const {
    seq,
    navSeqRef,
    cachedContent,
    content,
    activeTabPathRef,
    path,
  } = options

  if (navSeqRef.current !== seq) return false
  return cachedContent !== content || activeTabPathRef.current !== path
}

function handleEntryLoadFailure(options: {
  entry: VaultEntry
  seq: number
  navSeqRef: React.MutableRefObject<number>
  tabsRef: React.MutableRefObject<Tab[]>
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>
  error: unknown
}) {
  const {
    entry,
    seq,
    navSeqRef,
    tabsRef,
    setTabs,
    error,
  } = options

  console.warn('Failed to load note content:', error)
  if (navSeqRef.current !== seq) return
  setSingleTab(tabsRef, setTabs, { entry, content: '' })
}

async function navigateToEntry(options: {
  entry: VaultEntry
  navSeqRef: React.MutableRefObject<number>
  tabsRef: React.MutableRefObject<Tab[]>
  activeTabPathRef: React.MutableRefObject<string | null>
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>
  setActiveTabPath: React.Dispatch<React.SetStateAction<string | null>>
}) {
  const {
    entry,
    navSeqRef,
    tabsRef,
    activeTabPathRef,
    setTabs,
    setActiveTabPath,
  } = options

  if (entry.fileKind === 'binary') return
  if (isAlreadyViewingPath(tabsRef, activeTabPathRef, entry.path)) {
    syncActiveTabPath(activeTabPathRef, setActiveTabPath, entry.path)
    return
  }

  const { seq, cachedContent } = startEntryNavigation({
    entry,
    navSeqRef,
    tabsRef,
    activeTabPathRef,
    setTabs,
    setActiveTabPath,
  })

  try {
    const content = await loadNoteContent(entry.path)
    if (!shouldApplyLoadedEntry({
      seq,
      navSeqRef,
      cachedContent,
      content,
      activeTabPathRef,
      path: entry.path,
    })) return
    setSingleTab(tabsRef, setTabs, { entry, content })
  } catch (err) {
    handleEntryLoadFailure({
      entry,
      seq,
      navSeqRef,
      tabsRef,
      setTabs,
      error: err,
    })
  }
}

export function useTabManagement(options: TabManagementOptions = {}) {
  // Single-note model: tabs has 0 or 1 elements.
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null)
  const activeTabPathRef = useRef(activeTabPath)
  useEffect(() => { activeTabPathRef.current = activeTabPath })
  const tabsRef = useRef(tabs)
  useEffect(() => { tabsRef.current = tabs })

  // Sequence counter for rapid-switch safety: only the latest navigation wins.
  const navSeqRef = useRef(0)
  const beforeNavigateSeqRef = useRef(0)
  const beforeNavigate = options.beforeNavigate

  const executeNavigationWithBoundary = useCallback(async (
    targetPath: string,
    navigate: () => void | Promise<void>,
  ) => {
    const seq = ++beforeNavigateSeqRef.current
    const currentPath = activeTabPathRef.current
    if (beforeNavigate && currentPath && currentPath !== targetPath) {
      try {
        await beforeNavigate(currentPath, targetPath)
      } catch (err) {
        console.warn('Failed to persist note before navigation:', err)
        return
      }
      if (beforeNavigateSeqRef.current !== seq) return
    }
    await navigate()
  }, [beforeNavigate])

  /** Open a note — replaces the current note (single-note model). */
  const handleSelectNote = useCallback(async (entry: VaultEntry) => {
    await executeNavigationWithBoundary(entry.path, () => navigateToEntry({
      entry,
      navSeqRef,
      tabsRef,
      activeTabPathRef,
      setTabs,
      setActiveTabPath,
    }))
  }, [executeNavigationWithBoundary])

  const handleSwitchTab = useCallback((path: string) => {
    syncActiveTabPath(activeTabPathRef, setActiveTabPath, path)
  }, [])

  /** Open a tab with known content — no IPC round-trip. Used for newly created notes. */
  const openTabWithContent = useCallback((entry: VaultEntry, content: string) => {
    void executeNavigationWithBoundary(entry.path, () => {
      setSingleTab(tabsRef, setTabs, { entry, content })
      syncActiveTabPath(activeTabPathRef, setActiveTabPath, entry.path)
    })
  }, [executeNavigationWithBoundary])

  const handleReplaceActiveTab = useCallback(async (entry: VaultEntry) => {
    await executeNavigationWithBoundary(entry.path, () => navigateToEntry({
      entry,
      navSeqRef,
      tabsRef,
      activeTabPathRef,
      setTabs,
      setActiveTabPath,
    }))
  }, [executeNavigationWithBoundary])

  const closeAllTabs = useCallback(() => {
    tabsRef.current = []
    setTabs([])
    syncActiveTabPath(activeTabPathRef, setActiveTabPath, null)
  }, [])

  return {
    tabs,
    setTabs,
    activeTabPath,
    activeTabPathRef,
    handleSelectNote,
    openTabWithContent,
    handleSwitchTab,
    handleReplaceActiveTab,
    closeAllTabs,
  }
}
