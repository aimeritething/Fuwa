import { useMemo, useCallback } from 'react'
import type { VaultEntry, GitCommit } from '../types'
import { cn } from '@/lib/utils'
import { Separator } from './ui/separator'
import { parseFrontmatter, detectFrontmatterState } from '../utils/frontmatter'
import { DynamicPropertiesPanel } from './DynamicPropertiesPanel'
import {
  DynamicRelationshipsPanel,
  BacklinksPanel,
  ReferencedByPanel,
  GitHistoryPanel,
  InstancesPanel,
  NoteInfoPanel,
} from './InspectorPanels'
import { EmptyInspector, InitializePropertiesPrompt, InspectorHeader, InvalidFrontmatterNotice } from './inspector/InspectorChrome'
import { useBacklinks, useReferencedBy } from './inspector/useInspectorData'

export type FrontmatterValue = string | number | boolean | string[] | null

interface InspectorProps {
  collapsed: boolean
  onToggle: () => void
  entry: VaultEntry | null
  content: string | null
  entries: VaultEntry[]
  gitHistory: GitCommit[]
  vaultPath?: string
  onNavigate: (target: string) => void
  onViewCommitDiff?: (commitHash: string) => void
  onUpdateFrontmatter?: (path: string, key: string, value: FrontmatterValue) => Promise<void>
  onDeleteProperty?: (path: string, key: string) => Promise<void>
  onAddProperty?: (path: string, key: string, value: FrontmatterValue) => Promise<void>
  onCreateAndOpenNote?: (title: string) => Promise<boolean>
  onInitializeProperties?: (path: string) => void
  onToggleRawEditor?: () => void
}

export function Inspector({
  collapsed,
  onToggle,
  entry,
  content,
  entries,
  gitHistory,
  vaultPath,
  onNavigate,
  onViewCommitDiff,
  onUpdateFrontmatter,
  onDeleteProperty,
  onAddProperty,
  onCreateAndOpenNote,
  onInitializeProperties,
  onToggleRawEditor,
}: InspectorProps) {
  const referencedBy = useReferencedBy(entry, entries)
  const backlinks = useBacklinks(entry, entries, referencedBy)
  const frontmatter = useMemo(() => parseFrontmatter(content), [content])
  const frontmatterState = useMemo(() => detectFrontmatterState(content), [content])
  const typeEntryMap = useMemo(() => {
    const map: Record<string, VaultEntry> = {}
    for (const candidate of entries) {
      if (candidate.isA === 'Type') map[candidate.title] = candidate
    }
    return map
  }, [entries])

  const handleUpdateProperty = useCallback((key: string, value: FrontmatterValue) => {
    if (entry && onUpdateFrontmatter) onUpdateFrontmatter(entry.path, key, value)
  }, [entry, onUpdateFrontmatter])

  const handleDeleteProperty = useCallback((key: string) => {
    if (entry && onDeleteProperty) onDeleteProperty(entry.path, key)
  }, [entry, onDeleteProperty])

  const handleAddProperty = useCallback((key: string, value: FrontmatterValue) => {
    if (entry && onAddProperty) onAddProperty(entry.path, key, value)
  }, [entry, onAddProperty])

  return (
    <aside className={cn('flex flex-1 flex-col overflow-hidden border-l border-border bg-background text-foreground transition-[width] duration-200', collapsed && '!w-10 !min-w-10')}>
      <InspectorHeader collapsed={collapsed} onToggle={onToggle} />
      {!collapsed && (
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
          {entry ? (
            <>
              {frontmatterState === 'valid' ? (
                <>
                  <DynamicPropertiesPanel
                    entry={entry}
                    frontmatter={frontmatter}
                    entries={entries}
                    onUpdateProperty={onUpdateFrontmatter ? handleUpdateProperty : undefined}
                    onDeleteProperty={onDeleteProperty ? handleDeleteProperty : undefined}
                    onAddProperty={onAddProperty ? handleAddProperty : undefined}
                    onNavigate={onNavigate}
                  />
                  <DynamicRelationshipsPanel
                    frontmatter={frontmatter}
                    entries={entries}
                    typeEntryMap={typeEntryMap}
                    vaultPath={vaultPath}
                    onNavigate={onNavigate}
                    onAddProperty={onAddProperty ? handleAddProperty : undefined}
                    onUpdateProperty={onUpdateFrontmatter ? handleUpdateProperty : undefined}
                    onDeleteProperty={onDeleteProperty ? handleDeleteProperty : undefined}
                    onCreateAndOpenNote={onCreateAndOpenNote}
                  />
                  <InstancesPanel entry={entry} entries={entries} typeEntryMap={typeEntryMap} onNavigate={onNavigate} />
                  <ReferencedByPanel items={referencedBy} typeEntryMap={typeEntryMap} onNavigate={onNavigate} />
                </>
              ) : frontmatterState === 'invalid' ? (
                onToggleRawEditor && <InvalidFrontmatterNotice onFix={onToggleRawEditor} />
              ) : (
                onInitializeProperties && <InitializePropertiesPrompt onClick={() => onInitializeProperties(entry.path)} />
              )}
              {backlinks.length > 0 && <Separator />}
              <BacklinksPanel backlinks={backlinks} onNavigate={onNavigate} />
              <Separator />
              <NoteInfoPanel entry={entry} content={content} />
              {gitHistory.length > 0 && <Separator />}
              <GitHistoryPanel commits={gitHistory} onViewCommitDiff={onViewCommitDiff} />
            </>
          ) : (
            <EmptyInspector />
          )}
        </div>
      )}
    </aside>
  )
}
