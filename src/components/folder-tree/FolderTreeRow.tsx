import { memo, useCallback, type MouseEvent as ReactMouseEvent } from 'react'
import {
  CaretDown,
  CaretRight,
  Folder,
  FolderOpen,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { FolderNode, SidebarSelection } from '../../types'
import { FolderNameInput } from './FolderNameInput'

interface FolderTreeRowProps {
  depth: number
  expanded: Record<string, boolean>
  node: FolderNode
  onDeleteFolder?: (folderPath: string) => void
  onOpenMenu: (node: FolderNode, event: ReactMouseEvent<HTMLDivElement>) => void
  onRenameFolder?: (folderPath: string, nextName: string) => Promise<boolean> | boolean
  onSelect: (selection: SidebarSelection) => void
  onStartRenameFolder?: (folderPath: string) => void
  onToggle: (path: string) => void
  onCancelRenameFolder?: () => void
  renamingFolderPath?: string | null
  selection: SidebarSelection
}

function FolderRenameRow({
  indentation,
  node,
  onCancelRenameFolder,
  onRenameFolder,
}: {
  indentation: number
  node: FolderNode
  onCancelRenameFolder: () => void
  onRenameFolder: (folderPath: string, nextName: string) => Promise<boolean> | boolean
}) {
  return (
    <div style={{ paddingLeft: indentation }}>
      <FolderNameInput
        ariaLabel="Folder name"
        initialValue={node.name}
        placeholder="Folder name"
        selectTextOnFocus={true}
        testId="rename-folder-input"
        onCancel={onCancelRenameFolder}
        onSubmit={(nextName) => onRenameFolder(node.path, nextName)}
      />
    </div>
  )
}

function FolderItemRow({
  indentation,
  isExpanded,
  isSelected,
  node,
  onOpenMenu,
  onSelect,
  onStartRenameFolder,
  onToggle,
}: {
  indentation: number
  isExpanded: boolean
  isSelected: boolean
  node: FolderNode
  onOpenMenu: FolderTreeRowProps['onOpenMenu']
  onSelect: () => void
  onStartRenameFolder?: (folderPath: string) => void
  onToggle: (path: string) => void
}) {
  const hasChildren = node.children.length > 0
  const expandLabel = isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`

  return (
    <div
      className={cn(
        'group flex items-center gap-1 rounded-[5px] transition-colors',
        isSelected
          ? 'bg-[var(--accent-blue-light,rgba(0,100,255,0.08))] text-primary'
          : 'text-foreground hover:bg-accent',
      )}
      style={{ paddingLeft: indentation }}
      onContextMenu={(event) => {
        onSelect()
        onOpenMenu(node, event)
      }}
    >
      <FolderToggleButton
        expandLabel={expandLabel}
        hasChildren={hasChildren}
        isExpanded={isExpanded}
        onToggle={() => onToggle(node.path)}
      />
      <FolderSelectButton
        isExpanded={isExpanded}
        isSelected={isSelected}
        node={node}
        onSelect={onSelect}
        onStartRenameFolder={onStartRenameFolder}
      />
    </div>
  )
}

function FolderToggleButton({
  expandLabel,
  hasChildren,
  isExpanded,
  onToggle,
}: {
  expandLabel: string
  hasChildren: boolean
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className="h-6 w-4 shrink-0 p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
      disabled={!hasChildren}
      onClick={(event) => {
        event.stopPropagation()
        if (hasChildren) onToggle()
      }}
      aria-label={hasChildren ? expandLabel : undefined}
    >
      {hasChildren ? (
        isExpanded ? <CaretDown size={12} /> : <CaretRight size={12} />
      ) : (
        <span className="block h-3 w-3" />
      )}
    </Button>
  )
}

function FolderSelectButton({
  isExpanded,
  isSelected,
  node,
  onSelect,
  onStartRenameFolder,
}: {
  isExpanded: boolean
  isSelected: boolean
  node: FolderNode
  onSelect: () => void
  onStartRenameFolder?: (folderPath: string) => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        'h-7 flex-1 justify-start gap-2 rounded-[5px] px-2 py-0 text-left text-[13px]',
        isSelected ? 'font-medium text-primary hover:text-primary' : 'hover:text-foreground',
      )}
      title={node.path}
      onClick={onSelect}
      onDoubleClick={() => {
        onSelect()
        onStartRenameFolder?.(node.path)
      }}
      data-testid={`folder-row:${node.path}`}
    >
      {isSelected || isExpanded ? (
        <FolderOpen size={18} weight="fill" className="shrink-0" />
      ) : (
        <Folder size={18} className="shrink-0" />
      )}
      <span className="truncate">{node.name}</span>
    </Button>
  )
}

function FolderChildren({
  depth,
  expanded,
  node,
  onDeleteFolder,
  onOpenMenu,
  onRenameFolder,
  onSelect,
  onStartRenameFolder,
  onToggle,
  onCancelRenameFolder,
  renamingFolderPath,
  selection,
}: FolderTreeRowProps) {
  const isExpanded = expanded[node.path] ?? false
  const hasChildren = node.children.length > 0
  if (!isExpanded || !hasChildren) return null

  return (
    <div className="relative" style={{ paddingLeft: 15 }}>
      <div
        className="absolute top-0 bottom-0 bg-border"
        style={{ left: 15 + depth * 16, width: 1, opacity: 0.3 }}
      />
      {node.children.map((child) => (
        <FolderTreeRow
          key={child.path}
          depth={depth + 1}
          expanded={expanded}
          node={child}
          onDeleteFolder={onDeleteFolder}
          onOpenMenu={onOpenMenu}
          onRenameFolder={onRenameFolder}
          onSelect={onSelect}
          onStartRenameFolder={onStartRenameFolder}
          onToggle={onToggle}
          onCancelRenameFolder={onCancelRenameFolder}
          renamingFolderPath={renamingFolderPath}
          selection={selection}
        />
      ))}
    </div>
  )
}

export const FolderTreeRow = memo(function FolderTreeRow({
  depth,
  expanded,
  node,
  onDeleteFolder,
  onOpenMenu,
  onRenameFolder,
  onSelect,
  onStartRenameFolder,
  onToggle,
  onCancelRenameFolder,
  renamingFolderPath,
  selection,
}: FolderTreeRowProps) {
  const isExpanded = expanded[node.path] ?? false
  const isRenaming = renamingFolderPath === node.path
  const isSelected = selection.kind === 'folder' && selection.path === node.path
  const indentation = 8 + depth * 16
  const selectFolder = useCallback(() => {
    onSelect({ kind: 'folder', path: node.path })
  }, [node.path, onSelect])

  return (
    <>
      {isRenaming && onRenameFolder && onCancelRenameFolder ? (
        <FolderRenameRow
          indentation={indentation}
          node={node}
          onCancelRenameFolder={onCancelRenameFolder}
          onRenameFolder={onRenameFolder}
        />
      ) : (
        <FolderItemRow
          indentation={indentation}
          isExpanded={isExpanded}
          isSelected={isSelected}
          node={node}
          onOpenMenu={onOpenMenu}
          onSelect={selectFolder}
          onStartRenameFolder={onStartRenameFolder}
          onToggle={onToggle}
        />
      )}
      <FolderChildren
        depth={depth}
        expanded={expanded}
        node={node}
        onDeleteFolder={onDeleteFolder}
        onOpenMenu={onOpenMenu}
        onRenameFolder={onRenameFolder}
        onSelect={onSelect}
        onStartRenameFolder={onStartRenameFolder}
        onToggle={onToggle}
        onCancelRenameFolder={onCancelRenameFolder}
        renamingFolderPath={renamingFolderPath}
        selection={selection}
      />
    </>
  )
})
