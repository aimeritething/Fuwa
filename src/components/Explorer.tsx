import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { CaretDown, CaretRight, FileText, Folder, Image } from '@phosphor-icons/react'
import type { SidebarSelection } from '../types'
import { buildExplorerTree, type ExplorerNode, type ListedFile } from '../utils/explorer'
import { isPathInsideVaultRoot } from '../utils/vaultPathContainment'
import { ancestorTreePaths } from './folder-tree/folderTreeUtils'
import { useFolderTreeDisclosure } from './folder-tree/useFolderTreeDisclosure'
import './Explorer.css'

const NO_FOLDER_SELECTION: SidebarSelection = { kind: 'filter', filter: 'all' }

interface ExplorerProps {
  folder: string | null
  files: ListedFile[]
  activeTabPath: string | null
  onOpenNote: (path: string) => void
  error?: string | null
}

export const Explorer = memo(function Explorer({ folder, files, activeTabPath, onOpenNote, error }: ExplorerProps) {
  return (
    <section className="fuwa-explorer" data-testid="explorer">
      <div className="fuwa-sidebar__label">Explorer</div>
      {error && <div className="fuwa-explorer__message" role="status">{error}</div>}
      {folder && <ExplorerTree key={folder} folder={folder} files={files} activeTabPath={activeTabPath} onOpenNote={onOpenNote} />}
    </section>
  )
})

function ExplorerTree({ folder, files, activeTabPath, onOpenNote }: ExplorerProps & { folder: string }) {
  const root = useMemo(() => buildExplorerTree(folder, files), [folder, files])
  const [selected, setSelected] = useState<string | null>(activeTabPath)
  const [followedPath, setFollowedPath] = useState(activeTabPath)
  if (followedPath !== activeTabPath) {
    setFollowedPath(activeTabPath)
    setSelected(activeTabPath && isPathInsideVaultRoot(activeTabPath, folder) ? activeTabPath : null)
  }
  const { expanded, expandFolder, toggleFolder } = useFolderTreeDisclosure({ selection: NO_FOLDER_SELECTION })
  const treeRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!activeTabPath || !isPathInsideVaultRoot(activeTabPath, folder)) return
    expandFolder('')
    for (const path of ancestorTreePaths(activeTabPath.slice(folder.length + 1))) expandFolder(path)
  }, [activeTabPath, expandFolder, folder])
  useEffect(() => {
    const row = treeRef.current?.querySelector('[aria-selected="true"]')
    row?.scrollIntoView?.({ block: 'nearest' })
  }, [activeTabPath, expanded, files])

  return (
    <div ref={treeRef} className="fuwa-explorer__tree" role="tree" aria-label={root.name}>
      <ExplorerRow node={root} folder={folder} depth={0} expanded={expanded} selected={selected}
        onSelect={setSelected} onToggle={toggleFolder} onOpenNote={onOpenNote} />
    </div>
  )
}

interface RowProps {
  node: ExplorerNode
  folder: string
  depth: number
  expanded: Record<string, boolean>
  selected: string | null
  onSelect: (path: string) => void
  onToggle: (path: string) => void
  onOpenNote: (path: string) => void
}

function ExplorerRow(props: RowProps) {
  const { node, folder, depth, expanded, selected, onSelect, onToggle, onOpenNote } = props
  const isFolder = node.kind === 'folder'
  const relative = node.path === folder ? '' : node.path.slice(folder.length + 1)
  const isExpanded = expanded[relative] ?? depth === 0
  const active = selected === node.path
  const Icon = isFolder ? Folder : node.kind === 'image' ? Image : FileText
  const select = () => {
    if (node.kind === 'image') return
    onSelect(node.path)
    if (node.kind === 'note') onOpenNote(node.path)
  }
  return (
    <div role="treeitem" aria-label={node.name} aria-selected={active} aria-expanded={isFolder ? isExpanded : undefined}
      aria-level={depth + 1}>
      <div className="fuwa-sidebar-row fuwa-explorer__row" style={{ paddingLeft: 8 + depth * 14 }}
        data-active={active || undefined} data-testid={`explorer-row:${node.path}`} tabIndex={0} title={node.path}
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
      {isFolder && isExpanded && <div role="group">
        {node.children.map((child) => <ExplorerRow key={child.path} {...props} node={child} depth={depth + 1} />)}
      </div>}
    </div>
  )
}
