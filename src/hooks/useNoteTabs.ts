import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { Tab } from '../types'
import { noteEntryForPath, noteRootForPath } from '../utils/noteEntry'
import { restoreOpenEditors as restoreSurvivingEditors, type SessionEditor } from '../utils/sessionFile'
import { cacheNoteContent } from './noteContentCache'
import {
  activateAdjacentTab as activateAdjacent,
  activateTab as activate,
  activateTabAt as activateAt,
  closeTab as close,
  EMPTY_NOTE_TABS,
  openTab,
  type NoteTabsState,
} from './noteTabsState'

/**
 * The open Documents, in the kernel's `Tab` shape, under the Tab rules of
 * `noteTabsState`. Reads go through the boundary with the Document's own
 * directory as the root (ADR-0002) until the Folder ticket picks the root per
 * Tab. `setTabs` keeps the save hook's contract: it may replace a Tab's
 * content but never its order.
 */

async function readNoteContent(path: string, vaultPath: string): Promise<string> {
  const args = { path, vaultPath }
  return isTauri()
    ? invoke<string>('get_note_content', args)
    : mockInvoke<string>('get_note_content', args)
}

async function readTab(path: string): Promise<Tab> {
  const content = await readNoteContent(path, noteRootForPath(path))
  return { entry: noteEntryForPath(path, content), content }
}

function announceOpened(tab: Tab): void {
  cacheNoteContent(tab.entry.path, tab.content, tab.entry)
}

/** Read every Session entry; the ones that fail to read no longer exist and are dropped. */
async function readSurvivingTabs(editors: SessionEditor[]): Promise<Map<string, Tab>> {
  const reads = await Promise.allSettled(editors.map((editor) => readTab(editor.path)))
  const survivors = new Map<string, Tab>()
  reads.forEach((read, index) => {
    if (read.status === 'fulfilled') survivors.set(editors[index].path, read.value)
  })
  return survivors
}

export function useNoteTabs() {
  const [state, setState] = useState<NoteTabsState>(EMPTY_NOTE_TABS)
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const openNote = useCallback(async (path: string): Promise<void> => {
    const alreadyOpen = stateRef.current.tabs.some((tab) => tab.entry.path === path)
    if (alreadyOpen) {
      setState((prev) => activate(prev, path))
      return
    }
    const tab = await readTab(path)
    setState((prev) => openTab(prev, tab))
    announceOpened(tab)
  }, [])

  /** Restore rule (spec section 5): missing files are dropped, the active Tab falls to its successor. */
  const restoreOpenEditors = useCallback(async (editors: SessionEditor[], activePath: string | null) => {
    const survivors = await readSurvivingTabs(editors)
    const restored = restoreSurvivingEditors({ openEditors: editors, activePath }, new Set(survivors.keys()))
    const tabs = restored.openEditors.map((editor) => survivors.get(editor.path) as Tab)
    setState({ tabs, activeTabPath: restored.activePath })
    const activeTab = tabs.find((tab) => tab.entry.path === restored.activePath)
    if (activeTab) announceOpened(activeTab)
  }, [])

  const closeTab = useCallback((path: string) => setState((prev) => close(prev, path)), [])
  const activateTab = useCallback((path: string) => setState((prev) => activate(prev, path)), [])
  const activateTabAt = useCallback((index: number) => setState((prev) => activateAt(prev, index)), [])
  const activateAdjacentTab = useCallback(
    (direction: 1 | -1) => setState((prev) => activateAdjacent(prev, direction)),
    [],
  )

  const setTabs = useCallback((action: SetStateAction<Tab[]>) => {
    setState((prev) => {
      const tabs = typeof action === 'function' ? action(prev.tabs) : action
      return tabs === prev.tabs ? prev : { ...prev, tabs }
    })
  }, [])

  const { tabs, activeTabPath } = state
  const activeTab = useMemo(
    () => tabs.find((tab) => tab.entry.path === activeTabPath) ?? null,
    [activeTabPath, tabs],
  )

  return {
    tabs,
    setTabs,
    activeTab,
    activeTabPath,
    openNote,
    closeTab,
    activateTab,
    activateTabAt,
    activateAdjacentTab,
    restoreOpenEditors,
  }
}
