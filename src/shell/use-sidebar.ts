import { useCallback, useMemo, useState } from 'react'
import { clampSidebarWidth, DEFAULT_SESSION_SIDEBAR, type SessionSidebar, type SidebarSection } from '@/session/session-schema'

/**
 * The sidebar's persisted facts: whether it is collapsed, how wide it is when
 * shown, and which of its sections (Pinned, the Explorer) are folded away
 * under their label. All live in the Session's `sidebar` and come back on restore. Only the end states are held here; the transition
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

  /** A section's label: folds the section away, or opens it again. */
  const toggleSection = useCallback((section: SidebarSection) => {
    setSidebar((prev) => {
      const folded = prev.collapsedSections ?? []
      const collapsedSections = folded.includes(section) ? folded.filter((each) => each !== section) : [...folded, section]
      return { ...prev, collapsedSections }
    })
  }, [])

  /** Opens a folded section; an open one stays as it is. */
  const openSection = useCallback((section: SidebarSection) => {
    setSidebar((prev) => {
      const folded = prev.collapsedSections ?? []
      return folded.includes(section) ? { ...prev, collapsedSections: folded.filter((each) => each !== section) } : prev
    })
  }, [])

  const restore = useCallback((restored: SessionSidebar) => {
    const { collapsed, width, collapsedSections } = restored
    setSidebar({ collapsed, width: clampSidebarWidth(width), ...(collapsedSections?.length ? { collapsedSections } : {}) })
  }, [])

  return useMemo(() => ({ sidebar, toggle, collapse, setWidth, toggleSection, openSection, restore }), [collapse, openSection, restore, setWidth, sidebar, toggle, toggleSection])
}
