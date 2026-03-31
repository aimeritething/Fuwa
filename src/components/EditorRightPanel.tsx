import type { VaultEntry, GitCommit } from '../types'
import type { NoteListItem } from '../utils/ai-context'
import { Inspector, type FrontmatterValue } from './Inspector'
import { AiPanel } from './AiPanel'

interface EditorRightPanelProps {
  showAIChat?: boolean
  inspectorCollapsed: boolean
  inspectorWidth: number
  inspectorEntry: VaultEntry | null
  inspectorContent: string | null
  entries: VaultEntry[]
  gitHistory: GitCommit[]
  vaultPath: string
  noteList?: NoteListItem[]
  noteListFilter?: { type: string | null; query: string }
  onToggleInspector: () => void
  onToggleAIChat?: () => void
  onNavigateWikilink: (target: string) => void
  onViewCommitDiff: (commitHash: string) => Promise<void>
  onUpdateFrontmatter?: (path: string, key: string, value: FrontmatterValue) => Promise<void>
  onDeleteProperty?: (path: string, key: string) => Promise<void>
  onAddProperty?: (path: string, key: string, value: FrontmatterValue) => Promise<void>
  onCreateAndOpenNote?: (title: string) => Promise<boolean>
  onInitializeProperties?: (path: string) => void
  onToggleRawEditor?: () => void
  onOpenNote?: (path: string) => void
  onFileCreated?: (relativePath: string) => void
  onFileModified?: (relativePath: string) => void
  onVaultChanged?: () => void
}

export function EditorRightPanel({
  showAIChat, inspectorCollapsed, inspectorWidth,
  inspectorEntry, inspectorContent, entries, gitHistory, vaultPath,
  noteList, noteListFilter,
  onToggleInspector, onToggleAIChat, onNavigateWikilink, onViewCommitDiff,
  onUpdateFrontmatter, onDeleteProperty, onAddProperty, onCreateAndOpenNote, onInitializeProperties, onToggleRawEditor, onOpenNote,
  onFileCreated, onFileModified, onVaultChanged,
}: EditorRightPanelProps) {
  if (showAIChat) {
    return (
      <div
        className="shrink-0 flex flex-col min-h-0"
        style={{ width: inspectorWidth, minWidth: 240, height: '100%' }}
      >
        <AiPanel
          onClose={() => onToggleAIChat?.()}
          onOpenNote={onOpenNote}
          onFileCreated={onFileCreated}
          onFileModified={onFileModified}
          onVaultChanged={onVaultChanged}
          vaultPath={vaultPath}
          activeEntry={inspectorEntry}
          activeNoteContent={inspectorContent}
          entries={entries}
          noteList={noteList}
          noteListFilter={noteListFilter}
        />
      </div>
    )
  }

  if (inspectorCollapsed) return null

  return (
    <div
      className="shrink-0 flex flex-col min-h-0"
      style={{ width: inspectorWidth, height: '100%' }}
    >
      <Inspector
        collapsed={inspectorCollapsed}
        onToggle={onToggleInspector}
        entry={inspectorEntry}
        content={inspectorContent}
        entries={entries}
        gitHistory={gitHistory}
        onNavigate={onNavigateWikilink}
        onViewCommitDiff={onViewCommitDiff}
        onUpdateFrontmatter={onUpdateFrontmatter}
        onDeleteProperty={onDeleteProperty}
        onAddProperty={onAddProperty}
        onCreateAndOpenNote={onCreateAndOpenNote}
        onInitializeProperties={onInitializeProperties}
        onToggleRawEditor={onToggleRawEditor}
      />
    </div>
  )
}
