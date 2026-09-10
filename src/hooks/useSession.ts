import { useEffect, useEffectEvent, useState } from 'react'
import type { Tab } from '../types'
import { parseSession, sessionForOpenEditors, type SessionEditor } from '../utils/sessionFile'
import { readSessionFile, updateSessionFile } from '../utils/sessionStore'

interface UseSessionOptions {
  tabs: Tab[]
  activeTabPath: string | null
  /** Reopens the Session's Documents, dropping the ones that no longer exist. */
  restoreOpenEditors: (editors: SessionEditor[], activePath: string | null) => Promise<void> | void
}

/**
 * Restores the Session once at launch and hands every later change of the
 * open Tabs to the Session file. Nothing is written before the restore has
 * settled, so a launch never overwrites the file with the empty initial
 * state. A file with an unknown version restores nothing and is rewritten in
 * the current schema by the first write.
 */
export function useSession({ tabs, activeTabPath, restoreOpenEditors }: UseSessionOptions) {
  const [restored, setRestored] = useState(false)
  const restore = useEffectEvent(async () => {
    const session = parseSession(await readSessionFile())
    if (session) await restoreOpenEditors(session.openEditors, session.activePath)
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

  // Tab order and the active Tab are what this ticket persists; a content
  // change inside a Tab does not touch the file.
  const openPathsKey = tabs.map((tab) => tab.entry.path).join('\n')
  useEffect(() => {
    if (!restored) return
    const openPaths = openPathsKey === '' ? [] : openPathsKey.split('\n')
    updateSessionFile(sessionForOpenEditors(openPaths, activeTabPath)).catch((error: unknown) => {
      console.warn('[session] Failed to hand the Session to the file:', error)
    })
  }, [activeTabPath, openPathsKey, restored])

  return { restored }
}
