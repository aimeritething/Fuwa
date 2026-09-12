import { SidebarSimple } from '@phosphor-icons/react'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import './SidebarToggle.css'

const SHORTCUT = '⌘['

interface SidebarToggleProps {
  collapsed: boolean
  onToggle: () => void
}

/**
 * The sidebar's one affordance: the same glyph collapses the
 * sidebar from its top row and brings it back from the tab bar. Its tooltip
 * is mono and carries the shortcut, `Show sidebar ⌘[`, because the collapsed
 * window has nothing else to say how to get the sidebar back.
 */
export function SidebarToggle({ collapsed, onToggle }: SidebarToggleProps) {
  const label = collapsed ? 'Show sidebar' : 'Hide sidebar'
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="fuwa-sidebar-toggle"
          aria-label={label}
          data-testid="sidebar-toggle"
          onClick={onToggle}
        >
          <SidebarSimple size={16} aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="fuwa-sidebar-toggle__tip">
        {label} {SHORTCUT}
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * What the card's top row gains when the sidebar is collapsed and the card
 * goes edge-to-edge: the traffic lights, which macOS draws at the window's
 * top-left whatever the DOM holds, need their room, and the sidebar icon
 * sits right after them, before the first tab.
 */
export function CollapsedChrome({ onShowSidebar }: { onShowSidebar: () => void }) {
  return (
    <div className="fuwa-collapsed-chrome" data-testid="collapsed-chrome">
      <span className="fuwa-collapsed-chrome__lights" data-testid="traffic-lights" aria-hidden="true" />
      <SidebarToggle collapsed onToggle={onShowSidebar} />
    </div>
  )
}
