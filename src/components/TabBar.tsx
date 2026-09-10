import { memo } from 'react'
import type { Tab } from '../types'
import { CloseAffordance } from './CloseAffordance'

export interface TabBarProps {
  tabs: Tab[]
  activeTabPath: string | null
  onActivate: (path: string) => void
  onClose: (path: string) => void
}

/**
 * The tab bar (spec section 2): the card's 44px top row, tabs only, one per
 * open Document, the selected one raised, a close affordance on hover. Hidden
 * with no Tab open. The row itself is the window drag region; the tabs are
 * not, so a click on one lands on the Tab.
 */
export const TabBar = memo(function TabBar({ tabs, activeTabPath, onActivate, onClose }: TabBarProps) {
  if (tabs.length === 0) return null

  return (
    <div className="fuwa-tabs" role="tablist" data-testid="tab-bar" data-tauri-drag-region>
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

function TabPill({ path, filename, active, onActivate, onClose }: TabPillProps) {
  return (
    <div
      className="fuwa-tab"
      role="tab"
      aria-selected={active}
      aria-label={filename}
      tabIndex={active ? 0 : -1}
      title={path}
      data-testid={`tab:${path}`}
      data-active={active || undefined}
      onClick={() => onActivate(path)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onActivate(path)
      }}
    >
      <span className="fuwa-tab__name">{filename}</span>
      <CloseAffordance name={filename} onClose={() => onClose(path)} />
    </div>
  )
}
