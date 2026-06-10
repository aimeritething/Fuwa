import type { CSSProperties, RefObject, ReactNode } from 'react'
import { ClipboardText, FolderOpen, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { translate, type AppLocale } from '../../lib/i18n'

const folderContextMenuSurfaceClass = 'fixed z-50 w-max min-w-[min(11.25rem,calc(100vw-16px))] max-w-[min(22rem,calc(100vw-16px))] rounded-md border bg-popover p-1 shadow-md'
const folderContextMenuButtonClass = 'h-auto w-full max-w-full justify-start gap-2 px-2 py-1.5 text-sm'

export interface FolderContextMenuState {
  path: string
  rootPath?: string
  x: number
  y: number
}

interface FolderContextMenuProps {
  menu: FolderContextMenuState | null
  menuRef: RefObject<HTMLDivElement | null>
  onDelete?: (folderPath: string) => void
  onReveal?: (folderPath: string) => void
  onCopyPath?: (folderPath: string) => void
  onCreateNote?: (folderPath: string, rootPath?: string) => void
  onRename: (folderPath: string) => void
  locale?: AppLocale
}

function getFolderContextMenuStyle(menu: FolderContextMenuState): CSSProperties {
  return {
    left: menu.x,
    top: menu.y,
  }
}

function FolderMenuLabel({ children }: { children: ReactNode }) {
  return <span className="min-w-0 flex-1 truncate text-left">{children}</span>
}

export function FolderContextMenu({
  menu,
  menuRef,
  onDelete,
  onReveal,
  onCopyPath,
  onCreateNote,
  onRename,
  locale = 'en',
}: FolderContextMenuProps) {
  if (!menu) return null
  const canMutateFolder = menu.path.length > 0

  return (
    <div
      ref={menuRef}
      className={folderContextMenuSurfaceClass}
      style={getFolderContextMenuStyle(menu)}
      data-testid="folder-context-menu"
    >
      {onCreateNote && (
        <Button
          type="button"
          variant="ghost"
          className={folderContextMenuButtonClass}
          onClick={() => onCreateNote(menu.path, menu.rootPath)}
          data-testid="create-node-in-folder-menu-item"
        >
          <Plus size={14} className="shrink-0" />
          <FolderMenuLabel>{translate(locale, 'sidebar.action.createNodeInFolderMenu')}</FolderMenuLabel>
        </Button>
      )}
      {onReveal && (
        <Button
          type="button"
          variant="ghost"
          className={folderContextMenuButtonClass}
          onClick={() => onReveal(menu.path)}
          data-testid="reveal-folder-menu-item"
        >
          <FolderOpen size={14} className="shrink-0" />
          <FolderMenuLabel>{translate(locale, 'sidebar.action.revealFolderMenu')}</FolderMenuLabel>
        </Button>
      )}
      {onCopyPath && (
        <Button
          type="button"
          variant="ghost"
          className={folderContextMenuButtonClass}
          onClick={() => onCopyPath(menu.path)}
          data-testid="copy-folder-path-menu-item"
        >
          <ClipboardText size={14} className="shrink-0" />
          <FolderMenuLabel>{translate(locale, 'sidebar.action.copyFolderPathMenu')}</FolderMenuLabel>
        </Button>
      )}
      {canMutateFolder && (
        <Button
          type="button"
          variant="ghost"
          className={folderContextMenuButtonClass}
          onClick={() => onRename(menu.path)}
        >
          <PencilSimple size={14} className="shrink-0" />
          <FolderMenuLabel>{translate(locale, 'sidebar.action.renameFolderMenu')}</FolderMenuLabel>
        </Button>
      )}
      {canMutateFolder && (
        <Button
          type="button"
          variant="ghost"
          className={`${folderContextMenuButtonClass} text-destructive hover:text-destructive`}
          onClick={() => onDelete?.(menu.path)}
          data-testid="delete-folder-menu-item"
        >
          <Trash size={14} className="shrink-0" />
          <FolderMenuLabel>{translate(locale, 'sidebar.action.deleteFolderMenu')}</FolderMenuLabel>
        </Button>
      )}
    </div>
  )
}
