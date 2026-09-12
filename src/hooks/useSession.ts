import { useEffect, useEffectEvent, useState } from 'react'
import type { ThemeMode } from '../lib/themeMode'
import type { Tab } from '../types'
import { readSessionFile, updateSessionFile } from '../utils/sessionFile'
import { parseSession, sessionForOpenEditors, type OpenEditorInput, type SessionEditor, type SessionSidebar } from '../utils/sessionSchema'

interface UseSessionOptions {
  folder?: string | null
  restoreFolder?: (folder: string | null) => Promise<string | null>
  tabs: Tab[]
  activeTabPath: string | null
  /** The View → Appearance choice. */
  theme: ThemeMode
  /** Reopens the Session's Documents, dropping the ones that no longer exist. */
  restoreOpenEditors: (editors: SessionEditor[], activePath: string | null, folder?: string | null) => Promise<void> | void
  /** Puts the Session's appearance back. */
  restoreTheme: (theme: ThemeMode) => void
  /** Whether the sidebar is collapsed, and its width when shown. */
  sidebar: SessionSidebar
  restoreSidebar: (sidebar: SessionSidebar) => void
}

/** The Tabs as the Session file sees them, as one string so the write effect keys on it. */
function openEditorsKey(tabs: Tab[]): string {
  return JSON.stringify(tabs.map((tab): OpenEditorInput => ({ path: tab.entry.path, mode: tab.mode })))
}

/**
 * Restores the Session once at launch and hands every later change of the
 * Folder, open Tabs (each Document with its mode), appearance and
 * sidebar to the Session file. Nothing is written before
 * the restore has settled, so a launch never overwrites the file with the
 * empty initial state. A file with an unknown version restores nothing and
 * is rewritten in the current schema by the first write.
 */
export function useSession({
  folder = null, restoreFolder, tabs, activeTabPath, theme, restoreOpenEditors, restoreTheme, sidebar, restoreSidebar,
}: UseSessionOptions) {
  const [restored, setRestored] = useState(false)
  const restore = useEffectEvent(async () => {
    const session = parseSession(await readSessionFile())
    if (!session) return
    restoreTheme(session.theme)
    restoreSidebar(session.sidebar)
    if (restoreFolder) {
      const restoredFolder = await restoreFolder(session.folder)
      await restoreOpenEditors(session.openEditors, session.activePath, restoredFolder)
    } else {
      await restoreOpenEditors(session.openEditors, session.activePath)
    }
  })

  useEffect(() => {
    let cancelled = false
    restore()
      .catch((error: unknown) => {
        console.warn('[session] Starting fresh: the Session could not be restored:', error)
      })
      .finally(() => {
        if (!cancelled) setRestored(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Folder, Tab order, each Tab's mode, active Tab, appearance and sidebar
  // are what the file holds; a content change inside a Tab does not touch it.
  const editorsKey = openEditorsKey(tabs)
  const { collapsed, width } = sidebar
  useEffect(() => {
    if (!restored) return
    const openEditors = JSON.parse(editorsKey) as OpenEditorInput[]
    updateSessionFile(sessionForOpenEditors(openEditors, activeTabPath, theme, folder, { collapsed, width })).catch((error: unknown) => {
      console.warn('[session] Failed to hand the Session to the file:', error)
    })
  }, [activeTabPath, collapsed, editorsKey, folder, restored, theme, width])

  return { restored }
}
