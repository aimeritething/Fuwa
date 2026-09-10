import { useCallback, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { Tab } from '../types'
import { noteEntryForPath, noteRootForPath } from '../utils/noteEntry'
import { cacheNoteContent } from './noteContentCache'

/**
 * The open Documents, in the kernel's `Tab` shape. This first shell keeps one
 * Document at a time; the tab bar (AIM-380) widens it to many without
 * changing what the editor and the save hook see.
 */

async function readNoteContent(path: string, vaultPath: string): Promise<string> {
  const args = { path, vaultPath }
  return isTauri()
    ? invoke<string>('get_note_content', args)
    : mockInvoke<string>('get_note_content', args)
}

export function useNoteTabs() {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null)

  const openNote = useCallback(async (path: string): Promise<void> => {
    const content = await readNoteContent(path, noteRootForPath(path))
    const entry = noteEntryForPath(path, content)
    setTabs([{ entry, content }])
    setActiveTabPath(path)
    cacheNoteContent(path, content, entry)
  }, [])

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.entry.path === activeTabPath) ?? null,
    [activeTabPath, tabs],
  )

  return { tabs, setTabs, activeTab, activeTabPath, openNote }
}
