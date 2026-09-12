import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isDocumentPath } from '../utils/noteEntry'
import { openNotesSettled } from '../utils/noteOpenRequest'
import { listenForOpenRequests, takePendingOpen } from '../utils/pendingOpen'
import { cleanupTauriEventListener, type TauriUnlisten } from '../utils/tauriEventCleanup'

/**
 * Finder double-click, Open With and a drop on the Dock icon. The Rust side
 * buffers the paths and pokes; this hook drains the buffer through
 * `take_pending_open` and opens each path the way File → Open Document…
 * does: the active Document's pending edits reach disk first, a
 * Document already open has its Tab activated, and with no Folder open the
 * sidebar collapses (`openNote` is App's `openLoneNote`).
 *
 * Order matters twice. The listener is registered before the first drain, so
 * an open that lands between the two is not lost. And nothing is drained
 * until `ready` (the Session is restored): the Folder is then known, so the
 * sidebar rule reads the right state, and the Finder Document is the Tab
 * that ends up active rather than the Session's. A poke before `ready` needs
 * no bookkeeping; the paths wait in the buffer for that first drain.
 *
 * `settled` turns true once the first drain has run (or failed), so App can
 * keep the shell unpainted until the launch Document is in place and a
 * Finder launch never shows the Session's Tab for a frame.
 */

interface UseFinderOpenOptions {
  /** Opens a Document, or activates its Tab when it is already open. */
  openNote: (path: string) => Promise<void>
  /** Writes the active Document's pending edits, as opening from the menu does. */
  settleActiveNote: () => Promise<void>
  /** The Session is restored: the drain may run. */
  ready: boolean
}

export function useFinderOpen({ openNote, settleActiveNote, ready }: UseFinderOpenOptions): { settled: boolean } {
  const [listening, setListening] = useState(false)
  const [settled, setSettled] = useState(false)
  const readyRef = useRef(ready)
  const handlersRef = useRef({ openNote, settleActiveNote })
  useLayoutEffect(() => {
    readyRef.current = ready
    handlersRef.current = { openNote, settleActiveNote }
  }, [openNote, ready, settleActiveNote])

  // One drain at a time, in poke order: two could otherwise interleave their opens.
  const drains = useRef<Promise<void>>(Promise.resolve())
  const drain = useCallback(() => {
    drains.current = drains.current.then(async () => {
      const paths = (await takePendingOpen()).filter(isDocumentPath)
      await openNotesSettled({ ...handlersRef.current, paths })
    }).catch((error: unknown) => {
      console.warn('[finder-open] Could not drain the pending opens:', error)
    })
    return drains.current
  }, [])

  useEffect(() => {
    let disposed = false
    let unlisten: TauriUnlisten | null = null
    listenForOpenRequests(() => {
      if (readyRef.current) void drain()
    }).then((teardown) => {
      if (disposed) {
        cleanupTauriEventListener(teardown)
        return
      }
      unlisten = teardown
      setListening(true)
    }).catch((error: unknown) => {
      console.warn('[finder-open] Could not listen for open requests:', error)
      setListening(true)
    })
    return () => {
      disposed = true
      cleanupTauriEventListener(unlisten)
    }
  }, [drain])

  useEffect(() => {
    if (!listening || !ready) return
    let cancelled = false
    void drain().then(() => {
      if (!cancelled) setSettled(true)
    })
    return () => {
      cancelled = true
    }
  }, [drain, listening, ready])

  return { settled }
}
