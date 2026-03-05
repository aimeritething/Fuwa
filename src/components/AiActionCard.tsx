import { type KeyboardEvent, type ReactNode, useCallback } from 'react'
import {
  PencilSimple, MagnifyingGlass, Trash, ChartBar, Eye,
  CircleNotch, CheckCircle, XCircle, CaretRight, CaretDown,
  Terminal, File, FolderOpen, NotePencil,
} from '@phosphor-icons/react'

export type AiActionStatus = 'pending' | 'done' | 'error'

export interface AiActionCardProps {
  tool: string
  label: string
  path?: string
  status: AiActionStatus
  input?: string
  output?: string
  expanded: boolean
  onToggle: () => void
  onOpenNote?: (path: string) => void
}

const MAX_DETAIL_LENGTH = 800

type IconRenderer = (size: number) => ReactNode

const TOOL_ICON_MAP: Record<string, IconRenderer> = {
  // Native Claude Code tools
  Bash: (s) => <Terminal size={s} />,
  Write: (s) => <PencilSimple size={s} />,
  Edit: (s) => <NotePencil size={s} />,
  Read: (s) => <File size={s} />,
  Glob: (s) => <FolderOpen size={s} />,
  Grep: (s) => <MagnifyingGlass size={s} />,
  // Laputa MCP tools
  search_notes: (s) => <MagnifyingGlass size={s} />,
  get_vault_context: (s) => <ChartBar size={s} />,
  get_note: (s) => <File size={s} />,
  open_note: (s) => <Eye size={s} />,
  // Legacy tools (for backward compatibility with existing messages)
  create_note: (s) => <PencilSimple size={s} />,
  delete_note: (s) => <Trash size={s} />,
}

const DEFAULT_ICON: IconRenderer = (s) => <PencilSimple size={s} />

function StatusIndicator({ status }: { status: AiActionStatus }) {
  if (status === 'pending') {
    return <CircleNotch size={14} className="ai-spin text-muted-foreground" data-testid="status-pending" />
  }
  if (status === 'done') {
    return <CheckCircle size={14} weight="fill" style={{ color: 'var(--accent-green)' }} data-testid="status-done" />
  }
  return <XCircle size={14} weight="fill" style={{ color: 'var(--destructive)' }} data-testid="status-error" />
}

function truncateText(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_DETAIL_LENGTH) return { text, truncated: false }
  return { text: text.slice(0, MAX_DETAIL_LENGTH), truncated: true }
}

function formatInputForDisplay(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

function DetailBlock({ label, content, isError }: {
  label: string; content: string; isError?: boolean
}) {
  const { text, truncated } = truncateText(content)
  return (
    <div style={{ marginTop: 6 }}>
      <div
        className="text-muted-foreground"
        style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}
      >
        {label}
      </div>
      <pre
        data-testid={`detail-${label.toLowerCase()}`}
        style={{
          fontSize: 11,
          lineHeight: 1.4,
          margin: 0,
          padding: '4px 6px',
          borderRadius: 4,
          background: 'var(--muted)',
          color: isError ? 'var(--destructive)' : 'var(--foreground)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: 200,
          overflow: 'auto',
        }}
      >
        {text}{truncated && <span className="text-muted-foreground">{'…'}</span>}
      </pre>
    </div>
  )
}

/** Whether this tool is a Laputa UI-only tool (lighter styling). */
function isUiOnlyTool(tool: string): boolean {
  return tool === 'open_note'
}

export function AiActionCard({
  tool, label, path, status, input, output, expanded, onToggle, onOpenNote,
}: AiActionCardProps) {
  const renderIcon = TOOL_ICON_MAP[tool] ?? DEFAULT_ICON
  const hasDetails = !!(input || output)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggle()
    } else if (e.key === 'Escape' && expanded) {
      e.preventDefault()
      onToggle()
    }
  }, [onToggle, expanded])

  const handleClick = useCallback(() => {
    if (path && onOpenNote && !hasDetails) {
      onOpenNote(path)
    } else {
      onToggle()
    }
  }, [path, onOpenNote, hasDetails, onToggle])

  const formattedInput = input ? formatInputForDisplay(input) : undefined

  return (
    <div
      data-testid="ai-action-card"
      className="rounded"
      style={{
        fontSize: 12,
        background: isUiOnlyTool(tool) ? 'rgba(74, 158, 255, 0.06)' : 'rgba(74, 158, 255, 0.1)',
      }}
    >
      <div
        className="flex items-center gap-2"
        style={{ padding: '6px 10px', cursor: 'pointer' }}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        data-testid="action-card-header"
      >
        <span className="shrink-0 text-muted-foreground" style={{ width: 14, display: 'flex' }}>
          {hasDetails
            ? (expanded ? <CaretDown size={12} /> : <CaretRight size={12} />)
            : renderIcon(14)}
        </span>
        <span className="flex-1 truncate">{label}</span>
        <StatusIndicator status={status} />
      </div>
      {expanded && hasDetails && (
        <div
          data-testid="action-card-details"
          style={{ padding: '0 10px 8px 10px' }}
        >
          {formattedInput && <DetailBlock label="Input" content={formattedInput} />}
          {output && (
            <DetailBlock label="Output" content={output} isError={status === 'error'} />
          )}
        </div>
      )}
    </div>
  )
}
