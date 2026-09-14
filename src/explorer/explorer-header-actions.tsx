import { DotsThree, Plus } from '@phosphor-icons/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'

/**
 * The Explorer header's hover-only actions: "+" makes a new
 * Document where the selection points, and "…" holds exactly New Folder,
 * Collapse All, Reveal in Finder and Close Folder.
 */

interface ExplorerHeaderActionsProps {
  onNewDocument: () => void
  onNewFolder: () => void
  onCollapseAll: () => void
  onReveal: () => void
  onCloseFolder: () => void
}

export function ExplorerHeaderActions(props: ExplorerHeaderActionsProps) {
  const { onNewDocument, onNewFolder, onCollapseAll, onReveal, onCloseFolder } = props

  return (
    <div className="fuwa-explorer__actions">
      <button
        type="button"
        className="fuwa-explorer__action"
        data-testid="explorer-new-document"
        title="New Document"
        aria-label="New Document"
        onClick={onNewDocument}
      >
        <Plus size={12} aria-hidden="true" />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="fuwa-explorer__action"
          data-testid="explorer-more-actions"
          title="More actions"
          aria-label="More actions"
        >
          <DotsThree size={14} aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" data-testid="explorer-header-menu">
          <DropdownMenuItem onSelect={onNewFolder}>New Folder</DropdownMenuItem>
          <DropdownMenuItem onSelect={onCollapseAll}>Collapse All</DropdownMenuItem>
          <DropdownMenuItem onSelect={onReveal}>Reveal in Finder</DropdownMenuItem>
          <DropdownMenuItem onSelect={onCloseFolder}>Close Folder</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
