import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu'
import {
  EXPLORER_MENU_LABELS,
  explorerMenuEntries,
  type ExplorerMenuAction,
  type ExplorerMenuTargetKind,
} from './explorerMenuItems'

/**
 * The Explorer's right-click menu: Linear-styled on Radix `ContextMenu`, never
 * the native macOS menu. It acts on the row under the cursor
 * and changes neither the selection nor the active Tab.
 */

interface ExplorerContextMenuProps {
  target: ExplorerMenuTargetKind
  onAction: (action: ExplorerMenuAction) => void
}

export function ExplorerContextMenu({ target, onAction }: ExplorerContextMenuProps) {
  return (
    <ContextMenuContent data-testid={`explorer-menu:${target}`}>
      {explorerMenuEntries(target).map((entry, index) => (
        entry.kind === 'separator'
          ? <ContextMenuSeparator key={`separator-${index}`} />
          : (
            <ContextMenuItem key={entry.action} onSelect={() => onAction(entry.action)}>
              {EXPLORER_MENU_LABELS[entry.action]}
            </ContextMenuItem>
          )
      ))}
    </ContextMenuContent>
  )
}
