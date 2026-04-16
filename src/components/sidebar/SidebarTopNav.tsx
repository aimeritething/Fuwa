import { Archive, FileText, Tray } from '@phosphor-icons/react'
import type { SidebarSelection } from '../../types'
import { isSelectionActive, NavItem } from '../SidebarParts'

interface SidebarTopNavProps {
  selection: SidebarSelection
  onSelect: (selection: SidebarSelection) => void
  showInbox: boolean
  inboxCount: number
  activeCount: number
  archivedCount: number
}

export function SidebarTopNav({
  selection,
  onSelect,
  showInbox,
  inboxCount,
  activeCount,
  archivedCount,
}: SidebarTopNavProps) {
  return (
    <div className="border-b border-border" data-testid="sidebar-top-nav" style={{ padding: '4px 6px' }}>
      {showInbox && (
        <NavItem
          icon={Tray}
          label="Inbox"
          count={inboxCount}
          isActive={isSelectionActive(selection, { kind: 'filter', filter: 'inbox' })}
          badgeClassName="text-muted-foreground"
          badgeStyle={{ background: 'var(--muted)' }}
          activeBadgeClassName="bg-primary text-primary-foreground"
          onClick={() => onSelect({ kind: 'filter', filter: 'inbox' })}
        />
      )}
      <NavItem
        icon={FileText}
        label="All Notes"
        count={activeCount}
        isActive={isSelectionActive(selection, { kind: 'filter', filter: 'all' })}
        badgeClassName="text-muted-foreground"
        badgeStyle={{ background: 'var(--muted)' }}
        activeBadgeClassName="bg-primary text-primary-foreground"
        onClick={() => onSelect({ kind: 'filter', filter: 'all' })}
      />
      <NavItem
        icon={Archive}
        label="Archive"
        count={archivedCount}
        isActive={isSelectionActive(selection, { kind: 'filter', filter: 'archived' })}
        badgeClassName="text-muted-foreground"
        badgeStyle={{ background: 'var(--muted)' }}
        activeBadgeClassName="bg-primary text-primary-foreground"
        onClick={() => onSelect({ kind: 'filter', filter: 'archived' })}
      />
    </div>
  )
}
