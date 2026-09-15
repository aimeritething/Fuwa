import { SidebarSimple } from '@phosphor-icons/react'
import { Button } from '@/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'

const SHORTCUT = '⌘['

interface SidebarToggleProps {
  collapsed: boolean
  onToggle: () => void
}

/**
 * The sidebar's one affordance: the same glyph collapses the
 * sidebar from its top row and brings it back from the tab bar. A 24px ghost
 * icon button; both rows it sits on drag the window, the button does not. Its
 * tooltip carries the shortcut as a chip, `Show sidebar ⌘[`, because the
 * collapsed window has nothing else to say how to get the sidebar back.
 */
export function SidebarToggle({ collapsed, onToggle }: SidebarToggleProps) {
  const label = collapsed ? 'Show sidebar' : 'Hide sidebar'
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-xs" className="text-text-secondary" aria-label={label} data-testid="sidebar-toggle" onClick={onToggle}>
          <SidebarSimple size={16} aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" shortcut={SHORTCUT}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * What the card's top row gains when the sidebar is collapsed and the card
 * goes edge-to-edge: the traffic lights, which macOS draws at the window's
 * top-left whatever the DOM holds, need their room (x 13, three 12px lights
 * 8px apart: 71px), and the sidebar icon sits right after them, before the
 * first tab.
 */
export function CollapsedChrome({ onShowSidebar }: { onShowSidebar: () => void }) {
  return (
    <div className="mr-2 flex h-full flex-none items-center" data-testid="collapsed-chrome">
      <span className="w-17.75 flex-none" data-testid="traffic-lights" aria-hidden="true" />
      <SidebarToggle collapsed onToggle={onShowSidebar} />
    </div>
  )
}
