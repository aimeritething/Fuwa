import { memo, useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { CaretDown, CaretRight } from '@phosphor-icons/react'
import { ContextMenu, ContextMenuTrigger } from '@/ui/context-menu'
import type { SidebarSelection } from '@/types'
import { holdsDocument, type ExplorerNode } from '@/folder/explorer'
import type { ExplorerActions } from './use-explorer-actions'
import { isPathInsideVaultRoot } from '@/lib/vault-path-containment'
import { clearDraggedNotePath, readDraggedNotePath, writeNoteDragData } from './note-drag-drop'
import { ancestorTreePaths } from './folder-tree-utils'
import { useFolderTreeDisclosure } from './use-folder-tree-disclosure'
import { ExplorerContextMenu } from './explorer-context-menu'
import { ExplorerHeaderActions } from './explorer-header-actions'
import { ExplorerNameInput } from './explorer-name-input'
import { EXPLORER_ROW_ICONS, explorerRowIndent } from './explorer-row'
import type { ExplorerMenuAction, ExplorerMenuTargetKind } from './explorer-menu-items'
import { Button } from '@/ui/button'
import './explorer.css'

const NO_FOLDER_SELECTION: SidebarSelection = { kind: 'filter', filter: 'all' }

interface ExplorerProps {
  folder: string | null
  /** The tree App builds from the Folder listing; null with no Folder open. */
  tree: ExplorerNode | null
  activeTabPath: string | null
  /** A Document or an Image file row was activated; both open a real Tab. */
  onOpenFile: (path: string) => void
  actions: ExplorerActions
  onCloseFolder: () => void
  /** The Open Folder button's click, the same as ⌘O. */
  onOpenFolder: () => void
  /** "Folder not found: <path>", from a restore that lost its Folder or an Open Folder that would not list. */
  error?: string | null
}

type LoadedProps = ExplorerProps & { folder: string; tree: ExplorerNode }

/**
 * The Explorer: the Folder as a tree of Documents, sub-folders and Image
 * files, with the write operations over it — creation, inline rename, Move to
 * Trash and the drag-and-drop move, all reached from the Linear-styled context
 * menu or the row itself.
 */
export const Explorer = memo(function Explorer(props: ExplorerProps) {
  const { folder, tree, error, onOpenFolder } = props
  if (!folder || !tree) return <NoFolder error={error} onOpenFolder={onOpenFolder} />
  return (
    <section className="fuwa-explorer" data-testid="explorer">
      <ExplorerBody key={folder} {...props} folder={folder} tree={tree} />
      {error && <div className="fuwa-explorer__message" role="status">{error}</div>}
    </section>
  )
})

/**
 * The No-Folder state, identical on first launch: what to do
 * next, as a button and the drop hint. A restore that lost its Folder names
 * it above the button until any Folder is opened.
 */
function NoFolder({ error, onOpenFolder }: { error?: string | null; onOpenFolder: () => void }) {
  return (
    <section className="fuwa-explorer" data-testid="explorer">
      <div className="fuwa-sidebar__label fuwa-explorer__header">Explorer</div>
      <div className="fuwa-explorer__no-folder" data-testid="explorer-no-folder">
        <h4 className="fuwa-explorer__no-folder-title">No folder open</h4>
        <p className="fuwa-explorer__no-folder-copy">Fuwa reads Markdown from one folder at a time. Open one to browse it here.</p>
        {error && <p className="fuwa-explorer__folder-missing" role="status" data-testid="explorer-folder-missing">{error}</p>}
        <div>
          <Button type="button" aria-label="Open Folder ⌘O" onClick={onOpenFolder} data-testid="explorer-open-folder">
            Open Folder<kbd className="fuwa-explorer__kbd">⌘O</kbd>
          </Button>
        </div>
        <p className="fuwa-explorer__no-folder-or">or drop a <code>.md</code> file onto the window</p>
      </div>
    </section>
  )
}

/** Every folder's tree key, so Collapse All shuts the ones never touched too. */
function folderKeys(node: ExplorerNode, folder: string, keys: string[] = []): string[] {
  if (node.kind !== 'folder') return keys
  keys.push(node.path === folder ? '' : node.path.slice(folder.length + 1))
  for (const child of node.children) folderKeys(child, folder, keys)
  return keys
}

/** Open every folder above a path, so the row it names is on screen. */
function useRevealedInTree(path: string | null | undefined, folder: string, expandFolder: (key: string) => void) {
  useEffect(() => {
    if (!path || !isPathInsideVaultRoot(path, folder)) return
    expandFolder('')
    for (const ancestor of ancestorTreePaths(path.slice(folder.length + 1))) expandFolder(ancestor)
  }, [expandFolder, folder, path])
}

/**
 * The Folder's tree and the header actions over it, remounted per Folder so
 * the disclosure state starts fresh when the Folder changes.
 */
function ExplorerBody(props: LoadedProps) {
  const { folder, tree, activeTabPath, actions, onCloseFolder } = props
  const { collapseAll, expanded, expandFolder, toggleFolder } = useFolderTreeDisclosure({ selection: NO_FOLDER_SELECTION })
  const treeRef = useRef<HTMLDivElement>(null)
  const keys = useMemo(() => folderKeys(tree, folder), [folder, tree])
  const handleCollapseAll = useCallback(() => collapseAll(keys), [collapseAll, keys])

  useRevealedInTree(activeTabPath, folder, expandFolder)
  useRevealedInTree(actions.editing?.path, folder, expandFolder)

  // A row that has just been created, renamed or opened is brought into view.
  useEffect(() => {
    const row = treeRef.current?.querySelector('[aria-selected="true"]')
    row?.scrollIntoView?.({ block: 'nearest' })
  }, [actions.selected, activeTabPath, expanded, tree])

  return (
    <>
      <div className="fuwa-sidebar__label fuwa-explorer__header">
        Explorer
        <ExplorerHeaderActions
          onNewDocument={actions.createDocument}
          onNewFolder={actions.createFolder}
          onCollapseAll={handleCollapseAll}
          onReveal={() => actions.reveal(folder)}
          onCloseFolder={onCloseFolder}
        />
      </div>
      <div ref={treeRef} className="fuwa-explorer__tree" role="tree" aria-label={tree.name}>
        <ExplorerRow {...props} node={tree} depth={0} expanded={expanded} onToggle={toggleFolder} />
        {/* The empty-Folder line: no `.md` anywhere under the root. It goes with the first ⌘N. */}
        {!holdsDocument(tree) && (
          <div className="fuwa-explorer__no-documents" data-testid="explorer-no-documents">No documents yet · ⌘N</div>
        )}
        <EmptyAreaMenu actions={actions} folder={folder} />
      </div>
    </>
  )
}

/** The area below the tree: New Document and New Folder, both at the Folder root. */
function EmptyAreaMenu({ actions, folder }: { actions: ExplorerActions; folder: string }) {
  const onAction = useCallback((action: ExplorerMenuAction) => {
    if (action === 'newDocument') actions.createDocumentIn(folder)
    if (action === 'newFolder') actions.createFolderIn(folder)
  }, [actions, folder])

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="fuwa-explorer__empty-area" data-testid="explorer-empty-area" />
      </ContextMenuTrigger>
      <ExplorerContextMenu target="empty" onAction={onAction} />
    </ContextMenu>
  )
}

interface RowProps extends LoadedProps {
  node: ExplorerNode
  depth: number
  expanded: Record<string, boolean>
  onToggle: (path: string) => void
}

function useRowMenuAction(node: ExplorerNode, actions: ExplorerActions) {
  return useCallback((action: ExplorerMenuAction) => {
    switch (action) {
      case 'newDocument': return actions.createDocumentIn(node.path)
      case 'newFolder': return actions.createFolderIn(node.path)
      case 'rename': return actions.startRename(node.path, node.kind)
      case 'reveal': return actions.reveal(node.path)
      case 'copyPath': return actions.copyPath(node.path)
      case 'trash': return actions.trash(node.path, node.kind)
    }
  }, [actions, node.kind, node.path])
}

/**
 * Dragging a row: a Document or an Image file is the thing
 * dragged, a folder row or the root row is the thing dropped on, and a folder
 * is never dragged itself. The dragged path is written to the drag and kept
 * beside it, because a browser hides the data from `dragover` and, on some
 * platforms, from the drop as well.
 */
function useRowDragAndDrop(node: ExplorerNode, isFolder: boolean, actions: ExplorerActions) {
  const [isDropTarget, setDropTarget] = useState(false)

  const dragProps = useMemo(() => (isFolder ? {} : {
    draggable: true,
    onDragStart: (event: DragEvent<HTMLDivElement>) => writeNoteDragData(event.dataTransfer, node.path),
    onDragEnd: () => clearDraggedNotePath(),
  }), [isFolder, node.path])

  const dropProps = useMemo(() => (isFolder ? {
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      if (!readDraggedNotePath(event.dataTransfer)) return
      // Taking the event is what tells the browser this row accepts the drop.
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      setDropTarget(true)
    },
    onDragLeave: () => setDropTarget(false),
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      const dragged = readDraggedNotePath(event.dataTransfer)
      setDropTarget(false)
      clearDraggedNotePath()
      if (!dragged) return
      event.preventDefault()
      actions.moveInto(dragged, node.path)
    },
  } : {}), [actions, isFolder, node.path])

  return { dragProps, dropProps, isDropTarget }
}

function ExplorerRow(props: RowProps) {
  const { node, folder, depth, expanded, onToggle, onOpenFile, actions } = props
  const isFolder = node.kind === 'folder'
  const isRoot = node.path === folder
  const relative = isRoot ? '' : node.path.slice(folder.length + 1)
  const isExpanded = expanded[relative] ?? depth === 0
  const selected = actions.selected === node.path
  const Icon = EXPLORER_ROW_ICONS[node.kind]
  const onMenuAction = useRowMenuAction(node, actions)
  const target: ExplorerMenuTargetKind = isRoot ? 'root' : node.kind
  const editing = actions.editing?.path === node.path ? actions.editing : null
  const { dragProps, dropProps, isDropTarget } = useRowDragAndDrop(node, isFolder, actions)

  // A Document and an Image file both open a real Tab;
  // clicking a folder only selects it. Right-click does neither.
  const select = () => {
    actions.select(node.path)
    if (!isFolder) onOpenFile(node.path)
  }

  const children = isFolder && isExpanded && (
    <div role="group">
      {node.children.map((child) => <ExplorerRow key={child.path} {...props} node={child} depth={depth + 1} />)}
    </div>
  )

  if (editing) {
    return (
      <div role="treeitem" aria-label={node.name} aria-level={depth + 1}>
        <ExplorerNameInput
          stem={editing.stem}
          extension={editing.extension}
          kind={editing.kind}
          depth={depth}
          error={actions.error}
          onSubmit={actions.commitRename}
          onCancel={actions.cancelRename}
        />
        {children}
      </div>
    )
  }

  return (
    <div role="treeitem" aria-label={node.name} aria-selected={selected} aria-expanded={isFolder ? isExpanded : undefined}
      aria-level={depth + 1}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="fuwa-sidebar-row fuwa-explorer__row" style={{ paddingLeft: explorerRowIndent(depth) }}
            data-active={selected || undefined} data-drop-target={isDropTarget || undefined}
            data-testid={`explorer-row:${node.path}`} tabIndex={0} title={node.path}
            {...dragProps} {...dropProps}
            onClick={select} onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select() }
              if (isFolder && ((event.key === 'ArrowRight' && !isExpanded) || (event.key === 'ArrowLeft' && isExpanded))) {
                event.preventDefault(); onToggle(relative)
              }
            }}>
            {isFolder ? (
              <button className="fuwa-explorer__disclosure" tabIndex={-1} aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${node.name}`}
                onClick={(event) => { event.stopPropagation(); onToggle(relative) }}>
                {isExpanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
              </button>
            ) : <span className="fuwa-explorer__disclosure" />}
            <Icon size={14} className="fuwa-sidebar-row__icon" aria-hidden="true" />
            <span className="fuwa-sidebar-row__name">{node.name}</span>
          </div>
        </ContextMenuTrigger>
        <ExplorerContextMenu target={target} onAction={onMenuAction} />
      </ContextMenu>
      {children}
    </div>
  )
}
