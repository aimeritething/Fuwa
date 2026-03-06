import { useState, useEffect, useCallback, memo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { PulseCommit, PulseFile } from '../types'
import { relativeDate } from '../utils/noteListHelpers'
import {
  Plus, Minus, PencilSimple, GitCommit, ArrowSquareOut,
  FileText, CaretDown, CaretRight, Pulse,
} from '@phosphor-icons/react'

function tauriCall<T>(command: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : mockInvoke<T>(command, args)
}

interface PulseViewProps {
  vaultPath: string
  onOpenNote?: (relativePath: string) => void
  sidebarCollapsed?: boolean
  onExpandSidebar?: () => void
}

function groupCommitsByDay(commits: PulseCommit[]): Map<string, PulseCommit[]> {
  const groups = new Map<string, PulseCommit[]>()
  for (const commit of commits) {
    const date = new Date(commit.date * 1000)
    const key = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    const existing = groups.get(key)
    if (existing) {
      existing.push(commit)
    } else {
      groups.set(key, [commit])
    }
  }
  return groups
}

function isToday(dateKey: string): boolean {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  return dateKey === today
}

function isYesterday(dateKey: string): boolean {
  const yesterday = new Date(Date.now() - 86400000)
    .toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  return dateKey === yesterday
}

function formatDayLabel(dateKey: string): string {
  if (isToday(dateKey)) return 'Today'
  if (isYesterday(dateKey)) return 'Yesterday'
  return dateKey
}

const STATUS_ICON = {
  added: Plus,
  modified: PencilSimple,
  deleted: Minus,
} as const

const STATUS_COLOR = {
  added: 'var(--accent-green, #16a34a)',
  modified: 'var(--accent-orange, #ea580c)',
  deleted: 'var(--destructive, #dc2626)',
} as const

function SummaryBadges({ added, modified, deleted }: { added: number; modified: number; deleted: number }) {
  return (
    <div className="flex items-center" style={{ gap: 8 }}>
      {added > 0 && <span className="text-[11px] font-medium" style={{ color: STATUS_COLOR.added }}>+{added}</span>}
      {modified > 0 && <span className="text-[11px] font-medium" style={{ color: STATUS_COLOR.modified }}>~{modified}</span>}
      {deleted > 0 && <span className="text-[11px] font-medium" style={{ color: STATUS_COLOR.deleted }}>-{deleted}</span>}
    </div>
  )
}

function FileItem({ file, onOpenNote }: { file: PulseFile; onOpenNote?: (path: string) => void }) {
  const Icon = STATUS_ICON[file.status] ?? FileText
  const color = STATUS_COLOR[file.status] ?? 'var(--muted-foreground)'
  const isDeleted = file.status === 'deleted'

  return (
    <div
      className={`flex items-center rounded transition-colors ${isDeleted ? '' : 'cursor-pointer hover:bg-accent'}`}
      style={{ gap: 6, padding: '3px 8px' }}
      onClick={isDeleted ? undefined : () => onOpenNote?.(file.path)}
      title={file.path}
    >
      <Icon size={12} style={{ color, flexShrink: 0 }} weight="bold" />
      <span
        className={`truncate text-[12px] ${isDeleted ? 'text-muted-foreground line-through' : 'text-foreground'}`}
      >
        {file.title}
      </span>
    </div>
  )
}

function CommitCard({ commit, onOpenNote }: { commit: PulseCommit; onOpenNote?: (path: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const Chevron = expanded ? CaretDown : CaretRight

  return (
    <div className="border-b border-border" style={{ padding: '10px 16px' }}>
      <div className="flex items-start justify-between" style={{ gap: 8 }}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center" style={{ gap: 6, marginBottom: 2 }}>
            <GitCommit size={13} className="text-muted-foreground" style={{ flexShrink: 0 }} />
            <span className="truncate text-[13px] font-medium text-foreground">{commit.message}</span>
          </div>
          <div className="flex items-center" style={{ gap: 8 }}>
            <span className="text-[11px] text-muted-foreground">{relativeDate(commit.date)}</span>
            {commit.githubUrl ? (
              <a
                className="flex items-center text-[11px] font-mono text-primary no-underline hover:underline"
                style={{ gap: 3 }}
                href={commit.githubUrl}
                onClick={(e) => {
                  e.preventDefault()
                  if (isTauri()) {
                    import('@tauri-apps/plugin-opener').then((mod) => mod.openUrl(commit.githubUrl!))
                  } else {
                    window.open(commit.githubUrl!, '_blank')
                  }
                }}
                title="Open on GitHub"
              >
                {commit.shortHash}
                <ArrowSquareOut size={10} />
              </a>
            ) : (
              <span className="text-[11px] font-mono text-muted-foreground">{commit.shortHash}</span>
            )}
            <SummaryBadges added={commit.added} modified={commit.modified} deleted={commit.deleted} />
          </div>
        </div>
        <button
          className="flex shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-0 text-muted-foreground hover:text-foreground"
          style={{ width: 20, height: 20 }}
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse files' : 'Expand files'}
        >
          <Chevron size={12} />
        </button>
      </div>
      {expanded && commit.files.length > 0 && (
        <div style={{ marginTop: 6, marginLeft: 4 }}>
          {commit.files.map((file) => (
            <FileItem key={file.path} file={file} onOpenNote={onOpenNote} />
          ))}
        </div>
      )}
    </div>
  )
}

function DayGroup({ label, commits, onOpenNote }: {
  label: string; commits: PulseCommit[]; onOpenNote?: (path: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const Chevron = collapsed ? CaretRight : CaretDown

  return (
    <div>
      <div
        className="flex cursor-pointer select-none items-center border-b border-border bg-muted/50 transition-colors hover:bg-muted"
        style={{ padding: '6px 16px', gap: 6 }}
        onClick={() => setCollapsed((v) => !v)}
      >
        <Chevron size={12} className="text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-[11px] text-muted-foreground">
          ({commits.length} {commits.length === 1 ? 'commit' : 'commits'})
        </span>
      </div>
      {!collapsed && commits.map((commit) => (
        <CommitCard key={commit.hash} commit={commit} onOpenNote={onOpenNote} />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground" style={{ padding: 32 }}>
      <Pulse size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
      <p className="text-[13px]">No activity yet</p>
      <p className="text-[12px]" style={{ marginTop: 4 }}>
        Commit changes to see your vault's pulse
      </p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground" style={{ padding: 32 }}>
      <p className="text-[13px]">{message}</p>
      <button
        className="mt-2 cursor-pointer rounded border border-border bg-transparent px-3 py-1 text-[12px] text-foreground transition-colors hover:bg-accent"
        onClick={onRetry}
      >
        Retry
      </button>
    </div>
  )
}

export const PulseView = memo(function PulseView({ vaultPath, onOpenNote, sidebarCollapsed, onExpandSidebar }: PulseViewProps) {
  const [commits, setCommits] = useState<PulseCommit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const batchSize = 30

  const loadPulse = useCallback(async (limit: number) => {
    setLoading(true)
    setError(null)
    try {
      const result = await tauriCall<PulseCommit[]>('get_vault_pulse', { vaultPath, limit })
      setCommits(result)
      setHasMore(result.length >= limit)
    } catch (err) {
      const msg = typeof err === 'string' ? err : 'Failed to load activity'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [vaultPath])

  useEffect(() => { loadPulse(batchSize) }, [loadPulse])

  const handleLoadMore = useCallback(() => {
    const nextLimit = commits.length + batchSize
    loadPulse(nextLimit)
  }, [commits.length, loadPulse])

  const dayGroups = groupCommitsByDay(commits)

  return (
    <div className="flex h-full flex-col overflow-hidden border-r border-[var(--sidebar-border)] bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border" style={{ height: 52, padding: '0 16px' }}>
        <div className="flex items-center" style={{ gap: 8 }}>
          {sidebarCollapsed && onExpandSidebar && (
            <button
              className="flex shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-0 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              style={{ width: 24, height: 24 }}
              onClick={onExpandSidebar}
              aria-label="Expand sidebar"
            >
              <CaretRight size={14} weight="bold" />
            </button>
          )}
          <Pulse size={16} className="text-primary" />
          <span className="text-[14px] font-semibold text-foreground">Pulse</span>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        {loading && commits.length === 0 ? (
          <div className="flex items-center justify-center" style={{ padding: 32 }}>
            <span className="text-[13px] text-muted-foreground">Loading activity…</span>
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => loadPulse(batchSize)} />
        ) : commits.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {Array.from(dayGroups.entries()).map(([day, dayCommits]) => (
              <DayGroup
                key={day}
                label={formatDayLabel(day)}
                commits={dayCommits}
                onOpenNote={onOpenNote}
              />
            ))}
            {hasMore && (
              <div style={{ padding: '12px 16px' }}>
                <button
                  className="flex w-full cursor-pointer items-center justify-center rounded border border-border bg-transparent py-2 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={handleLoadMore}
                  disabled={loading}
                >
                  {loading ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
})
