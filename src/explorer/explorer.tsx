import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type RefObject } from 'react'
import { ContextMenu, ContextMenuTrigger } from '@/ui/context-menu'
import type { SidebarSelection } from '@/types'
import { holdsDocument, type ExplorerNode } from '@/folder/explorer'
import type { ExplorerActions } from './use-explorer-actions'
import { isPathInsideVaultRoot } from '@/lib/vault-path-containment'
import { cn } from '@/lib/cn'
import { clearDraggedNotePath, readDraggedNotePath, writeNoteDragData } from './note-drag-drop'
import { ancestorTreePaths } from './folder-tree-utils'
import { useFolderTreeDisclosure } from './use-folder-tree-disclosure'
import type { ExplorerMemory } from './use-explorer-memory'
import { ExplorerContextMenu } from './explorer-context-menu'
import { ExplorerHeaderActions } from './explorer-header-actions'
import { ExplorerNameInput } from './explorer-name-input'
import { EXPLORER_ROW_ICONS, explorerRowIndent } from './explorer-row'
import { ExplorerDisclosure, ExplorerDisclosureSlot } from './explorer-disclosure'
import type { ExplorerMenuAction, ExplorerMenuTargetKind } from './explorer-menu-items'
import { Button } from '@/ui/button'
import { Kbd } from '@/ui/kbd'
import { ScrollArea } from '@/ui/scroll-area'
import { OPENS_A_TAB_PROPS, SidebarLabel, SidebarRow, SidebarRowIcon, SidebarRowName } from '@/shell/sidebar-row'

const NO_FOLDER_SELECTION: SidebarSelection = { kind: 'filter', filter: 'all' }

interface ExplorerProps {
  folder: string | null
  /** The tree App builds from the Folder listing; null with no Folder open. */
  tree: ExplorerNode | null
  activeTabPath: string | null
  /** A Document or an Image file row was activated; both open a real Tab. */
  onOpenFile: (path: string) => void
  actions: ExplorerActions
  /** What outlives the Explorer while the sidebar is collapsed: the folders opened by hand, the scroll position. */
  memory: ExplorerMemory
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
 * menu or the row itself. The section is a named `group` so the header's
 * hover-only actions can read the pointer over any of it.
 */
export const Explorer = memo(function Explorer(props: ExplorerProps) {
  const { folder, tree, error, onOpenFolder } = props
  if (!folder || !tree) return <NoFolder error={error} onOpenFolder={onOpenFolder} />
  return (
    <section className="group/explorer mt-3 flex min-h-0 flex-col" data-testid="explorer">
      <ExplorerBody key={folder} {...props} folder={folder} tree={tree} />
      {error && <div className="p-2 text-xs leading-normal wrap-anywhere" role="status">{error}</div>}
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
    <section className="mt-3 flex min-h-0 flex-col" data-testid="explorer">
      <SidebarLabel className="justify-between">Explorer</SidebarLabel>
      <div className="flex cursor-default flex-col gap-2 px-2 pt-2.5 pb-2" data-testid="explorer-no-folder">
        <h4 className="text-sm leading-normal font-medium text-text-primary">No folder open</h4>
        <p className="mb-0.5 text-xs leading-normal font-normal text-text-secondary">Plumo reads Markdown from one folder at a time. Open one to browse it here.</p>
        {error && (
          <p className="mb-0.5 font-mono text-2xs leading-normal font-normal text-chroma-red-text wrap-anywhere" role="status" data-testid="explorer-folder-missing">
            {error}
          </p>
        )}
        <div>
          <Button type="button" aria-label="Open Folder ⌘O" onClick={onOpenFolder} data-testid="explorer-open-folder">
            Open Folder<Kbd>⌘O</Kbd>
          </Button>
        </div>
        <p className="mt-0.5 text-xs leading-normal font-normal text-text-muted">
          or drop a <code className="font-mono text-2xs">.md</code> file onto the window
        </p>
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

const SCROLL_VIEWPORT_SELECTOR = '[data-slot="scroll-area-viewport"]'

/** The tree's scroll position, put back when the sidebar is expanded again. */
function useRememberedScroll(treeRef: RefObject<HTMLDivElement | null>, view: ExplorerMemory['view']) {
  useLayoutEffect(() => {
    const viewport = treeRef.current?.querySelector<HTMLElement>(SCROLL_VIEWPORT_SELECTOR)
    if (!viewport) return
    viewport.scrollTop = view().scrollTop
    const remember = () => { view().scrollTop = viewport.scrollTop }
    viewport.addEventListener('scroll', remember, { passive: true })
    return () => {
      // Once more on the way out, while the viewport is still in the document.
      if (viewport.isConnected) remember()
      viewport.removeEventListener('scroll', remember)
    }
  }, [treeRef, view])
}

interface RowIntoViewOptions {
  treeRef: RefObject<HTMLDivElement | null>
  folder: string
  tree: ExplorerNode
  selected: string | null
  editingPath: string | null
  expanded: Record<string, boolean>
  expandFolder: (key: string) => void
  view: ExplorerMemory['view']
}

/**
 * A row that has just been selected (a click, the active Tab) or has just
 * entered rename is brought into view: the folders above it open, and the tree
 * scrolls to it once, when its row is there. That can be a render later (the
 * folders have to open first) or a refresh later (a new file is selected
 * before it is listed). Nothing else scrolls the tree: not a folder opening or
 * shutting, not a refresh from the watcher, not a rename ending, and not the
 * sidebar coming back with the same rows it left with.
 */
function useRowBroughtIntoView({ treeRef, folder, tree, selected, editingPath, expanded, expandFolder, view }: RowIntoViewOptions) {
  const pendingRef = useRef<'selected' | 'editing' | null>(null)

  useEffect(() => {
    const seen = view()
    const pending = editingPath && editingPath !== seen.revealedEditing ? 'editing'
      : selected && selected !== seen.revealedSelected ? 'selected'
        : null
    seen.revealedEditing = editingPath
    seen.revealedSelected = selected
    if (!pending) return

    const path = pending === 'editing' ? editingPath : selected
    if (!path || !isPathInsideVaultRoot(path, folder)) return
    pendingRef.current = pending
    expandFolder('')
    for (const ancestor of ancestorTreePaths(path.slice(folder.length + 1))) expandFolder(ancestor)
  }, [editingPath, expandFolder, folder, selected, view])

  useEffect(() => {
    const pending = pendingRef.current
    if (!pending) return
    const row = treeRef.current?.querySelector(pending === 'editing' ? '[data-testid="explorer-rename-input"]' : '[aria-selected="true"]')
    if (!row) return
    pendingRef.current = null
    row.scrollIntoView?.({ block: 'nearest' })
  }, [editingPath, expanded, selected, tree, treeRef])
}

/**
 * The Folder's tree and the header actions over it, remounted per Folder so
 * the disclosure state starts fresh when the Folder changes. The tree scrolls
 * inside a `ScrollArea`; the section shrinks to give it the room.
 */
function ExplorerBody(props: LoadedProps) {
  const { folder, tree, actions, memory, onCloseFolder } = props
  const { collapseAll, expanded, expandFolder, toggleFolder } = useFolderTreeDisclosure({
    selection: NO_FOLDER_SELECTION,
    expandedState: [memory.manualExpanded, memory.setManualExpanded],
  })
  const treeRef = useRef<HTMLDivElement>(null)
  const keys = useMemo(() => folderKeys(tree, folder), [folder, tree])
  const handleCollapseAll = useCallback(() => collapseAll(keys), [collapseAll, keys])

  useRememberedScroll(treeRef, memory.view)
  useRowBroughtIntoView({
    treeRef, folder, tree, expanded, expandFolder,
    selected: actions.selected,
    editingPath: actions.editing?.path ?? null,
    view: memory.view,
  })

  return (
    <>
      <SidebarLabel className="justify-between">
        Explorer
        <ExplorerHeaderActions
          onNewDocument={actions.createDocument}
          onNewFolder={actions.createFolder}
          onCollapseAll={handleCollapseAll}
          onReveal={() => actions.reveal(folder)}
          onCloseFolder={onCloseFolder}
        />
      </SidebarLabel>
      <ScrollArea ref={treeRef} className="min-h-0" role="tree" aria-label={tree.name}>
        <ExplorerRow {...props} node={tree} depth={0} expanded={expanded} onToggle={toggleFolder} />
        {/* The empty-Folder line: no `.md` anywhere under the root. It goes with the first ⌘N. */}
        {!holdsDocument(tree) && (
          <div className="cursor-default py-1 pr-2 pl-4 font-mono text-2xs font-normal text-text-muted" data-testid="explorer-no-documents">
            No documents yet · ⌘N
          </div>
        )}
        <EmptyAreaMenu actions={actions} folder={folder} />
      </ScrollArea>
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
        <div className="min-h-6" data-testid="explorer-empty-area" />
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

  // The selection is the treeitem's `aria-selected`, right above the row. The
  // row reads that parent and only that parent (`in-aria-selected:` would match
  // any ancestor, and a selected folder's children sit inside its treeitem).
  // The folder row under a dragged file takes the selected colours and an inset
  // ring, so it is clear which folder the file would land in.
  return (
    <div role="treeitem" aria-label={node.name} aria-selected={selected} aria-expanded={isFolder ? isExpanded : undefined}
      aria-level={depth + 1}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <SidebarRow
            className={cn(
              'mb-px [[aria-selected=true]>&]:bg-sidebar-row-active [[aria-selected=true]>&]:text-text-heading',
              'data-drop-target:bg-sidebar-row-active data-drop-target:text-text-heading data-drop-target:ring-1 data-drop-target:ring-state-focus-ring data-drop-target:ring-inset',
              // WebKit will not start an HTML5 drag from inside `user-select: none` (the whole shell) without this.
              !isFolder && '[-webkit-user-drag:element]',
            )}
            style={{ paddingLeft: explorerRowIndent(depth) }}
            data-drop-target={isDropTarget || undefined}
            data-testid={`explorer-row:${node.path}`} tabIndex={0} title={node.path}
            {...(!isFolder && OPENS_A_TAB_PROPS)}
            {...dragProps} {...dropProps}
            onClick={select} onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select() }
              if (isFolder && ((event.key === 'ArrowRight' && !isExpanded) || (event.key === 'ArrowLeft' && isExpanded))) {
                event.preventDefault(); onToggle(relative)
              }
            }}>
            {isFolder ? <ExplorerDisclosure name={node.name} expanded={isExpanded} onToggle={() => onToggle(relative)} /> : <ExplorerDisclosureSlot />}
            <SidebarRowIcon icon={Icon} className="[[aria-selected=true]>*>&]:text-text-primary" />
            <SidebarRowName>{node.name}</SidebarRowName>
          </SidebarRow>
        </ContextMenuTrigger>
        <ExplorerContextMenu target={target} onAction={onMenuAction} />
      </ContextMenu>
      {children}
    </div>
  )
}
