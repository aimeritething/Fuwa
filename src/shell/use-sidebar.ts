import { useCallback, useMemo, useState } from 'react'
import { clampSidebarWidth, DEFAULT_SESSION_SIDEBAR, type SessionSidebar } from '@/session/session-schema'

/**
 * The sidebar's two persisted facts: whether it is collapsed
 * and how wide it is when shown. Both live in the Session's `sidebar` and
 * come back on restore. Only the end states are held here; the transition
 * between them is the stylesheet's.
 */
export function useSidebar() {
  const [sidebar, setSidebar] = useState<SessionSidebar>(DEFAULT_SESSION_SIDEBAR)

  const toggle = useCallback(() => {
    setSidebar((prev) => ({ ...prev, collapsed: !prev.collapsed }))
  }, [])

  /** Opening a Document with no Folder open collapses the sidebar; a second collapse changes nothing. */
  const collapse = useCallback(() => {
    setSidebar((prev) => (prev.collapsed ? prev : { ...prev, collapsed: true }))
  }, [])

  const setWidth = useCallback((width: number) => {
    setSidebar((prev) => {
      const next = clampSidebarWidth(width)
      return next === prev.width ? prev : { ...prev, width: next }
    })
  }, [])

  const restore = useCallback((restored: SessionSidebar) => {
    setSidebar({ collapsed: restored.collapsed, width: clampSidebarWidth(restored.width) })
  }, [])

  return useMemo(() => ({ sidebar, toggle, collapse, setWidth, restore }), [collapse, restore, setWidth, sidebar, toggle])
}
