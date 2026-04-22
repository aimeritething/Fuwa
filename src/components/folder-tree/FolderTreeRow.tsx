import { memo, useCallback, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import {
  CaretDown,
  CaretRight,
  Folder,
  FolderOpen,
  PencilSimple,
  Trash,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { FolderNode, SidebarSelection } from '../../types'
import { NoteDropTarget } from '../note-retargeting/NoteDropTarget'
import { useNoteRetargetingContext } from '../note-retargeting/noteRetargetingContext'
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
  contentInset,
  depthIndent,
  node,
  onCancelRenameFolder,
  onRenameFolder,
}: {
  contentInset: number
  depthIndent: number
  node: FolderNode
  onCancelRenameFolder: () => void
  onRenameFolder: (folderPath: string, nextName: string) => Promise<boolean> | boolean
}) {
  return (
    <div style={{ paddingLeft: depthIndent }}>
      <FolderNameInput
        ariaLabel="Folder name"
        initialValue={node.name}
        placeholder="Folder name"
        leftInset={contentInset}
        selectTextOnFocus={true}
        testId="rename-folder-input"
        onCancel={onCancelRenameFolder}
        onSubmit={(nextName) => onRenameFolder(node.path, nextName)}
      />
    </div>
  )
}

function FolderItemRow({
  contentInset,
  depthIndent,
  isExpanded,
  isSelected,
  node,
  onDeleteFolder,
  onOpenMenu,
  onSelect,
  onStartRenameFolder,
  onToggle,
}: {
  contentInset: number
  depthIndent: number
  isExpanded: boolean
  isSelected: boolean
  node: FolderNode
  onDeleteFolder?: (folderPath: string) => void
  onOpenMenu: FolderTreeRowProps['onOpenMenu']
  onSelect: () => void
  onStartRenameFolder?: (folderPath: string) => void
  onToggle: (path: string) => void
}) {
  const hasChildren = node.children.length > 0
  const expandLabel = isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`
  const hasActions = !!onStartRenameFolder || !!onDeleteFolder

  return (
    <div
      className={cn(
        'group relative flex items-center gap-1 rounded transition-colors',
        isSelected
          ? 'bg-[var(--accent-blue-light,rgba(0,100,255,0.08))] text-primary'
          : 'text-foreground hover:bg-accent',
      )}
      style={{ paddingLeft: depthIndent, borderRadius: 4 }}
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
        contentInset={contentInset}
        hasActions={hasActions}
        hasChildren={hasChildren}
        isExpanded={isExpanded}
        isSelected={isSelected}
        node={node}
        onSelect={onSelect}
        onStartRenameFolder={onStartRenameFolder}
      />
      {hasActions && (
        <div className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
          {onStartRenameFolder && (
            <FolderActionButton
              ariaLabel={`Rename ${node.name}`}
              testId={`rename-folder-btn:${node.path}`}
              title="Rename folder"
              onClick={() => {
                onSelect()
                onStartRenameFolder(node.path)
              }}
            >
              <PencilSimple size={12} />
            </FolderActionButton>
          )}
          {onDeleteFolder && (
            <FolderActionButton
              ariaLabel={`Delete ${node.name}`}
              testId={`delete-folder-btn:${node.path}`}
              title="Delete folder"
              destructive
              onClick={() => {
                onSelect()
                onDeleteFolder(node.path)
              }}
            >
              <Trash size={12} />
            </FolderActionButton>
          )}
        </div>
      )}
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
  if (!hasChildren) return null

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className="h-6 w-4 shrink-0 p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      aria-label={expandLabel}
    >
      {isExpanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
    </Button>
  )
}

function FolderActionButton({
  ariaLabel,
  children,
  destructive = false,
  onClick,
  testId,
  title,
}: {
  ariaLabel: string
  children: ReactNode
  destructive?: boolean
  onClick: () => void
  testId: string
  title: string
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={ariaLabel}
      title={title}
      className={cn(
        'h-5 w-5 rounded p-0 text-muted-foreground',
        destructive ? 'hover:text-destructive' : 'hover:text-foreground',
      )}
      data-testid={testId}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      {children}
    </Button>
  )
}

function FolderSelectButton({
  contentInset,
  hasActions,
  hasChildren,
  isExpanded,
  isSelected,
  node,
  onSelect,
  onStartRenameFolder,
}: {
  contentInset: number
  hasActions: boolean
  hasChildren: boolean
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
        'h-auto flex-1 justify-start gap-2 rounded text-left text-[13px] font-medium hover:bg-transparent',
        isSelected ? 'text-primary hover:text-primary' : 'text-foreground hover:text-foreground',
      )}
      style={{
        paddingTop: 6,
        paddingBottom: 6,
        paddingLeft: hasChildren ? 0 : contentInset,
        paddingRight: hasActions ? 48 : 16,
      }}
      title={node.path}
      onClick={onSelect}
      onDoubleClick={() => {
        onSelect()
        onStartRenameFolder?.(node.path)
      }}
      data-testid={`folder-row:${node.path}`}
    >
      {isSelected || isExpanded ? (
        <FolderOpen size={17} weight="fill" className="size-[17px] shrink-0" />
      ) : (
        <Folder size={17} className="size-[17px] shrink-0" />
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
  const depthIndent = depth * 16
  const contentInset = 16
  const noteRetargeting = useNoteRetargetingContext()
  const selectFolder = useCallback(() => {
    onSelect({ kind: 'folder', path: node.path })
  }, [node.path, onSelect])
  const row = (
    <FolderItemRow
      contentInset={contentInset}
      depthIndent={depthIndent}
      isExpanded={isExpanded}
      isSelected={isSelected}
      node={node}
      onDeleteFolder={onDeleteFolder}
      onOpenMenu={onOpenMenu}
      onSelect={selectFolder}
      onStartRenameFolder={onStartRenameFolder}
      onToggle={onToggle}
    />
  )

  return (
    <>
      {isRenaming && onRenameFolder && onCancelRenameFolder ? (
        <FolderRenameRow
          contentInset={contentInset}
          depthIndent={depthIndent}
          node={node}
          onCancelRenameFolder={onCancelRenameFolder}
          onRenameFolder={onRenameFolder}
        />
      ) : (
        noteRetargeting ? (
          <NoteDropTarget
            canAcceptNotePath={(notePath) => noteRetargeting.canDropNoteOnFolder(notePath, node.path)}
            onDropNote={(notePath) => noteRetargeting.dropNoteOnFolder(notePath, node.path)}
          >
            {row}
          </NoteDropTarget>
        ) : row
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
