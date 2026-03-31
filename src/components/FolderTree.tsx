import { useState, useCallback, memo } from 'react'
import { Folder, FolderOpen, CaretDown, CaretRight, Plus } from '@phosphor-icons/react'
import type { FolderNode, SidebarSelection } from '../types'
import { cn } from '@/lib/utils'

interface FolderTreeProps {
  folders: FolderNode[]
  selection: SidebarSelection
  onSelect: (selection: SidebarSelection) => void
}

function FolderItem({
  node, depth, selection, expanded, onToggle, onSelect,
}: {
  node: FolderNode
  depth: number
  selection: SidebarSelection
  expanded: Record<string, boolean>
  onToggle: (path: string) => void
  onSelect: (selection: SidebarSelection) => void
}) {
  const isSelected = selection.kind === 'folder' && selection.path === node.path
  const isExpanded = expanded[node.path] ?? false
  const hasChildren = node.children.length > 0

  const handleClick = () => {
    onSelect({ kind: 'folder', path: node.path })
    if (hasChildren) onToggle(node.path)
  }

  return (
    <>
      <button
        className={cn(
          'flex w-full items-center gap-2 rounded-[5px] border-none bg-transparent cursor-pointer text-left transition-colors',
          isSelected
            ? 'bg-[var(--accent-blue-light,rgba(0,100,255,0.08))] text-primary'
            : 'text-foreground hover:bg-accent',
        )}
        style={{ padding: '5px 8px', paddingLeft: 8 + depth * 16, fontSize: 13 }}
        onClick={handleClick}
        title={node.path}
      >
        {isSelected || isExpanded ? (
          <FolderOpen size={18} weight="fill" className="shrink-0" />
        ) : (
          <Folder size={18} className="shrink-0" />
        )}
        <span className={cn('truncate', isSelected && 'font-medium')}>{node.name}</span>
      </button>
      {isExpanded && hasChildren && (
        <div className="relative" style={{ paddingLeft: 15 }}>
          <div
            className="absolute top-0 bottom-0 bg-border"
            style={{ left: 15 + depth * 16, width: 1, opacity: 0.3 }}
          />
          {node.children.map((child) => (
            <FolderItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selection={selection}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </>
  )
}

export const FolderTree = memo(function FolderTree({ folders, selection, onSelect }: FolderTreeProps) {
  const [sectionCollapsed, setSectionCollapsed] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggleFolder = useCallback((path: string) => {
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }))
  }, [])

  if (folders.length === 0) return null

  return (
    <div style={{ padding: '8px 0' }}>
      {/* Header */}
      <button
        className="flex w-full cursor-pointer select-none items-center justify-between border-none bg-transparent text-muted-foreground"
        style={{ padding: '6px 14px 6px 16px' }}
        onClick={() => setSectionCollapsed((v) => !v)}
      >
        <div className="flex items-center gap-1">
          {sectionCollapsed ? <CaretRight size={12} /> : <CaretDown size={12} />}
          <span className="text-[10px] font-semibold" style={{ letterSpacing: 0.5 }}>FOLDERS</span>
        </div>
        <Plus size={12} className="text-muted-foreground" />
      </button>

      {/* Tree */}
      {!sectionCollapsed && (
        <div className="flex flex-col gap-0.5" style={{ padding: '2px 6px 8px 14px' }}>
          {folders.map((node) => (
            <FolderItem
              key={node.path}
              node={node}
              depth={0}
              selection={selection}
              expanded={expanded}
              onToggle={toggleFolder}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
})
