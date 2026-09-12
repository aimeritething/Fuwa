import { CollapsedChrome } from './SidebarToggle'

interface EmptyCardProps {
  hasFolder: boolean
  sidebarCollapsed: boolean
  onShowSidebar: () => void
}

const NO_FOLDER_HINTS = [['⌘O', 'open folder']] as const
const FOLDER_HINTS = [['⌘N', 'new document'], ['⌘P', 'quick open']] as const

/**
 * The card with no Tab open: the dim wordmark and the mono
 * hint for what to do next. With no Folder that is opening one; with a
 * Folder it is a new Document or Quick Open. The tab bar and the path row
 * are not rendered at all, so the top strip keeps the window draggable and,
 * collapsed, seats the traffic lights and the sidebar icon in their place.
 */
export function EmptyCard({ hasFolder, sidebarCollapsed, onShowSidebar }: EmptyCardProps) {
  const hints = hasFolder ? FOLDER_HINTS : NO_FOLDER_HINTS
  return (
    <>
      <div className="fuwa-card__top" data-tauri-drag-region>
        {sidebarCollapsed && <CollapsedChrome onShowSidebar={onShowSidebar} />}
      </div>
      <div className="fuwa-empty" data-testid="editor-empty-state">
        <span className="fuwa-empty__wordmark">Fuwa</span>
        <div className="fuwa-empty__hints">
          {hints.map(([keys, action], index) => (
            <span key={keys} className="fuwa-empty__hint-group">
              {index > 0 && <span className="fuwa-empty__dot" aria-hidden="true">·</span>}
              <span data-testid="empty-hint"><b>{keys}</b>{action}</span>
            </span>
          ))}
        </div>
      </div>
    </>
  )
}
