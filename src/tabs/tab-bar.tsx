import { memo } from 'react'
import { Image } from '@phosphor-icons/react'
import type { Tab } from '@/types'
import { isImageFilePath } from './image-file'
import { CloseAffordance } from './close-affordance'
import { CollapsedChrome } from '@/shell/sidebar-toggle'

export interface TabBarProps {
  tabs: Tab[]
  activeTabPath: string | null
  onActivate: (path: string) => void
  onClose: (path: string) => void
  /** Collapsed, the row seats the traffic lights and the sidebar icon before the first tab. */
  sidebarCollapsed?: boolean
  onShowSidebar?: () => void
}

/**
 * The tab bar: the card's 44px top row, tabs only, one per
 * open Document or Image file, the selected one raised, a close affordance on
 * hover. Hidden with no Tab open. The row itself is the window drag region;
 * the tabs are not, so a click on one lands on the Tab. An Image file's Tab
 * carries the image icon before its name, a Document's nothing. With the
 * sidebar collapsed the card is edge-to-edge, so this row is where the
 * traffic lights land and where the sidebar comes back from; the lights' room
 * then starts at the window edge.
 */
export const TabBar = memo(function TabBar({ tabs, activeTabPath, onActivate, onClose, sidebarCollapsed = false, onShowSidebar }: TabBarProps) {
  if (tabs.length === 0) return null

  return (
    <div
      className="flex h-11 flex-none items-center gap-0.5 overflow-hidden border-b-hairline border-border-default pr-2.5 pl-2 select-none data-collapsed:pl-0 [-webkit-app-region:drag]"
      role="tablist"
      data-testid="tab-bar"
      data-collapsed={sidebarCollapsed || undefined}
      data-tauri-drag-region
    >
      {sidebarCollapsed && onShowSidebar && <CollapsedChrome onShowSidebar={onShowSidebar} />}
      {tabs.map(({ entry }) => (
        <TabPill
          key={entry.path}
          path={entry.path}
          filename={entry.filename}
          active={entry.path === activeTabPath}
          onActivate={onActivate}
          onClose={onClose}
        />
      ))}
    </div>
  )
})

interface TabPillProps {
  path: string
  filename: string
  active: boolean
  onActivate: (path: string) => void
  onClose: (path: string) => void
}

/** One tab: 28px, 6px radius; the selected one is raised off the row by a hairline ring and a drop. */
function TabPill({ path, filename, active, onActivate, onClose }: TabPillProps) {
  const isImage = isImageFilePath(path)
  return (
    <div
      className="group flex h-7 max-w-55 min-w-0 flex-initial cursor-default items-center gap-1.75 rounded-md pr-1.5 pl-2.5 text-[13px] whitespace-nowrap text-text-secondary outline-none hover:bg-tab-hover hover:text-text-heading aria-selected:bg-tab-active aria-selected:text-text-heading aria-selected:shadow-raised focus-visible:focus-ring [-webkit-app-region:no-drag]"
      role="tab"
      aria-selected={active}
      aria-label={filename}
      tabIndex={active ? 0 : -1}
      title={path}
      data-testid={`tab:${path}`}
      onClick={() => onActivate(path)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onActivate(path)
      }}
    >
      {isImage && <Image size={13} className="flex-none text-text-secondary" aria-hidden="true" />}
      <span className="min-w-0 truncate" data-testid="tab-name">{filename}</span>
      <CloseAffordance name={filename} onClose={() => onClose(path)} />
    </div>
  )
}
