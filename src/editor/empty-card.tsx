import { CollapsedChrome } from '@/shell/sidebar-toggle'

interface EmptyCardProps {
  hasFolder: boolean
  sidebarCollapsed: boolean
  onShowSidebar: () => void
}

const NO_FOLDER_HINTS = [['⌘O', 'open folder']] as const
const FOLDER_HINTS = [['⌘N', 'new document'], ['⌘P', 'quick open']] as const

/**
 * The card with no Tab open: the dim wordmark and the hint for what to do
 * next, its key in mono. With no Folder that is opening one; with a
 * Folder it is a new Document or Quick Open. The tab bar and the path row
 * are not rendered at all, so the top strip keeps the window draggable and,
 * collapsed, seats the traffic lights and the sidebar icon in their place.
 */
export function EmptyCard({ hasFolder, sidebarCollapsed, onShowSidebar }: EmptyCardProps) {
  const hints = hasFolder ? FOLDER_HINTS : NO_FOLDER_HINTS
  return (
    <>
      <div className="flex h-11 flex-none items-center" data-tauri-drag-region>
        {sidebarCollapsed && <CollapsedChrome onShowSidebar={onShowSidebar} />}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2.5 text-text-muted" data-testid="editor-empty-state">
        <span className="text-sm font-medium tracking-[-0.01em]">Plumo</span>
        <div className="flex gap-5.5 text-xs tracking-normal">
          {hints.map(([keys, action], index) => (
            <span key={keys} className="flex gap-5.5">
              {index > 0 && <span aria-hidden="true">·</span>}
              <span className="text-text-tertiary" data-testid="empty-hint"><b className="mr-1.5 font-mono font-normal text-text-secondary">{keys}</b>{action}</span>
            </span>
          ))}
        </div>
      </div>
    </>
  )
}
