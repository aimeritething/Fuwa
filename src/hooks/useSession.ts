import { useEffect, useEffectEvent, useState } from 'react'
import type { ThemeMode } from '../lib/themeMode'
import type { Tab } from '../types'
import { readSessionFile, updateSessionFile } from '../utils/sessionFile'
import { parseSession, sessionForOpenEditors, type SessionEditor } from '../utils/sessionSchema'

interface UseSessionOptions {
  tabs: Tab[]
  activeTabPath: string | null
  /** The View → Appearance choice. */
  theme: ThemeMode
  /** Reopens the Session's Documents, dropping the ones that no longer exist. */
  restoreOpenEditors: (editors: SessionEditor[], activePath: string | null) => Promise<void> | void
  /** Puts the Session's appearance back. */
  restoreTheme: (theme: ThemeMode) => void
}

/**
 * Restores the Session once at launch and hands every later change of the
 * open Tabs and the appearance to the Session file. Nothing is written before
 * the restore has settled, so a launch never overwrites the file with the
 * empty initial state. A file with an unknown version restores nothing and
 * is rewritten in the current schema by the first write.
 */
export function useSession({ tabs, activeTabPath, theme, restoreOpenEditors, restoreTheme }: UseSessionOptions) {
  const [restored, setRestored] = useState(false)
  const restore = useEffectEvent(async () => {
    const session = parseSession(await readSessionFile())
    if (!session) return
    restoreTheme(session.theme)
    await restoreOpenEditors(session.openEditors, session.activePath)
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

  // Tab order, the active Tab and the appearance are what the file holds; a
  // content change inside a Tab does not touch it.
  const openPathsKey = tabs.map((tab) => tab.entry.path).join('\n')
  useEffect(() => {
    if (!restored) return
    const openPaths = openPathsKey === '' ? [] : openPathsKey.split('\n')
    updateSessionFile(sessionForOpenEditors(openPaths, activeTabPath, theme)).catch((error: unknown) => {
      console.warn('[session] Failed to hand the Session to the file:', error)
    })
  }, [activeTabPath, openPathsKey, restored, theme])

  return { restored }
}
