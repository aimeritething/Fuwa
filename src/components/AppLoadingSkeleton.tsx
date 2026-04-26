import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlignJustify,
  Archive,
  CheckCircle2,
  ChevronDown,
  Code2,
  FileText,
  GitBranch,
  Inbox,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const SIDEBAR_GROUPS = [
  { rows: ['62%', '48%', '58%', '52%'], count: '24px' },
  { rows: ['72%'], count: '30px' },
  { rows: ['34%', '42%', '38%', '56%', '50%', '44%', '39%', '46%'], count: '26px' },
  { rows: ['38%', '52%', '32%'] },
]

const NOTE_ROWS = [
  { selected: false, title: '68%', snippet: '84%', chips: ['56px'] },
  { selected: true, title: '62%', snippet: '78%', chips: ['64px', '54px', '72px'] },
  { selected: false, title: '48%', snippet: '44%', chips: [] },
  { selected: false, title: '82%', snippet: '74%', chips: ['68px'] },
  { selected: false, title: '70%', snippet: '88%', chips: ['76px', '92px'] },
  { selected: false, title: '58%', snippet: '66%', chips: ['64px'] },
  { selected: false, title: '76%', snippet: '72%', chips: ['72px'] },
]

const EDITOR_ACTIONS = [Star, CheckCircle2, GitBranch, Code2, AlignJustify, Sparkles, Archive, Trash2, SlidersHorizontal]
const STATUS_LEFT = ['70px', '104px', '88px', '116px', '82px']
const STATUS_RIGHT = ['44px', '78px', '18px', '18px']

type AppLoadingSkeletonProps = {
  noteListWidth?: number
  showNoteList?: boolean
  showSidebar?: boolean
  sidebarWidth?: number
}

function SkeletonBar({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      className={cn('animate-pulse rounded bg-muted', className)}
      style={style}
    />
  )
}

function SkeletonIcon({ icon: Icon, active = false }: { icon: LucideIcon; active?: boolean }) {
  return (
    <Icon
      size={16}
      strokeWidth={1.9}
      className={cn(active ? 'text-primary' : 'text-muted-foreground', 'shrink-0 opacity-70')}
    />
  )
}

function SidebarRow({ icon, width, active = false, countWidth }: {
  icon: LucideIcon
  width: string
  active?: boolean
  countWidth?: string
}) {
  return (
    <div
      className={cn('flex items-center gap-2 rounded px-4 py-1.5', active && 'bg-primary/10')}
      style={active ? { boxShadow: 'inset 3px 0 0 var(--primary)' } : undefined}
    >
      <SkeletonIcon icon={icon} active={active} />
      <SkeletonBar className="h-3" style={{ width }} />
      {countWidth && <SkeletonBar className="h-5 rounded-full" style={{ width: countWidth }} />}
    </div>
  )
}

function SidebarSkeletonGlyph() {
  return <SkeletonBar className="h-4 w-4 shrink-0 rounded-[4px]" />
}

function SidebarStubRow({ width, countWidth }: {
  width: string
  countWidth?: string
}) {
  return (
    <div className="flex items-center gap-2 rounded px-4 py-1.5">
      <SidebarSkeletonGlyph />
      <SkeletonBar className="h-3" style={{ width }} />
      {countWidth && <SkeletonBar className="h-5 rounded-full" style={{ width: countWidth }} />}
    </div>
  )
}

function SidebarGroupSkeleton({ rows, count }: { rows: string[]; count?: string }) {
  return (
    <div className="border-b border-border px-1.5 pb-2">
      <div className="flex items-center gap-1 px-4 py-2">
        <ChevronDown size={12} className="text-muted-foreground opacity-60" />
        <SkeletonBar className="h-2.5" style={{ width: '54px' }} />
        {count && <SkeletonBar className="ml-auto h-4 rounded-full" style={{ width: count }} />}
      </div>
      <div className="flex flex-col gap-1">
        {rows.map((width, index) => (
          <SidebarStubRow
            key={`${width}-${index}`}
            width={width}
            countWidth={index > 3 ? '30px' : undefined}
          />
        ))}
      </div>
    </div>
  )
}

function SidebarSkeleton() {
  return (
    <aside className="flex h-full flex-col overflow-hidden border-r border-[var(--sidebar-border)] bg-sidebar text-sidebar-foreground">
      <div className="h-[52px] shrink-0 border-b border-border" />
      <nav className="flex-1 overflow-hidden py-1">
        <div className="border-b border-border px-1.5 pb-1">
          <SidebarRow icon={Inbox} width="48%" active countWidth="30px" />
          <SidebarRow icon={FileText} width="54%" countWidth="38px" />
          <SidebarRow icon={Archive} width="42%" countWidth="32px" />
        </div>
        {SIDEBAR_GROUPS.map((group, index) => (
          <SidebarGroupSkeleton key={index} rows={group.rows} count={group.count} />
        ))}
      </nav>
    </aside>
  )
}

function NoteRowSkeleton({ selected, title, snippet, chips }: {
  selected: boolean
  title: string
  snippet: string
  chips: string[]
}) {
  return (
    <div
      className={cn('relative border-b border-border px-5 py-4', selected && 'bg-primary/5')}
      style={selected ? { boxShadow: 'inset 3px 0 0 var(--accent-green)' } : undefined}
    >
      <SkeletonBar className="absolute right-4 top-4 h-3.5 w-3.5 rounded-sm" />
      <SkeletonBar className="mb-3 h-3.5" style={{ width: title }} />
      <div className="space-y-1.5">
        <SkeletonBar className="h-2.5" style={{ width: snippet }} />
        <SkeletonBar className="h-2.5" style={{ width: '58%' }} />
      </div>
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((width) => (
            <SkeletonBar key={width} className="h-5 rounded" style={{ width }} />
          ))}
        </div>
      )}
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-3">
        <SkeletonBar className="h-2.5" style={{ width: '38px' }} />
        <SkeletonBar className="h-2.5" style={{ width: '72px' }} />
      </div>
    </div>
  )
}

function NoteListSkeleton() {
  return (
    <section className="flex h-full flex-col overflow-hidden border-r border-border bg-card text-foreground">
      <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-border px-4">
        <SkeletonBar className="h-4" style={{ width: '78px' }} />
        <div className="flex items-center gap-3 text-muted-foreground">
          <SkeletonBar className="h-2.5" style={{ width: '58px' }} />
          <Search size={16} />
          <SlidersHorizontal size={16} />
          <Plus size={16} />
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        {NOTE_ROWS.map((row, index) => (
          <NoteRowSkeleton key={index} {...row} />
        ))}
      </div>
    </section>
  )
}

function EditorSkeleton() {
  return (
    <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-border px-5">
        <div className="flex items-center gap-2">
          <SkeletonBar className="h-3" style={{ width: '44px' }} />
          <SkeletonBar className="h-3" style={{ width: '150px' }} />
        </div>
        <div className="flex items-center gap-5 text-muted-foreground">
          {EDITOR_ACTIONS.map((Icon, index) => (
            <Icon key={index} size={16} strokeWidth={1.8} className="opacity-65" />
          ))}
        </div>
      </header>
      <article className="mx-auto flex w-full max-w-[760px] flex-1 flex-col px-10 py-16">
        <SkeletonBar className="mb-7 h-9" style={{ width: '58%' }} />
        <SkeletonBar className="mb-6 h-px w-full rounded-none" />
        <div className="space-y-4">
          <SkeletonBar className="h-4" style={{ width: '52%' }} />
          <SkeletonBar className="h-4" style={{ width: '92%' }} />
          <SkeletonBar className="h-4" style={{ width: '82%' }} />
          <SkeletonBar className="h-4" style={{ width: '88%' }} />
          <SkeletonBar className="h-4" style={{ width: '74%' }} />
        </div>
        <SkeletonBar className="my-10 h-px w-full rounded-none" />
        <div className="space-y-4">
          <SkeletonBar className="h-4" style={{ width: '22%' }} />
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex items-center gap-4 pl-4">
              <SkeletonBar className="h-2.5 w-2.5 rounded-full bg-primary/70" />
              <SkeletonBar className="h-4" style={{ width: index === 1 ? '54%' : '44%' }} />
            </div>
          ))}
        </div>
      </article>
    </main>
  )
}

function StatusSkeleton() {
  return (
    <footer
      className="flex shrink-0 items-center justify-between border-t border-border bg-sidebar px-2 text-muted-foreground"
      style={{ height: 30 }}
    >
      <div className="flex items-center gap-4">
        {STATUS_LEFT.map((width, index) => (
          <SkeletonBar key={`${width}-${index}`} className="h-3" style={{ width }} />
        ))}
      </div>
      <div className="flex items-center gap-4">
        {STATUS_RIGHT.map((width, index) => (
          <SkeletonBar key={`${width}-${index}`} className="h-3" style={{ width }} />
        ))}
        <Settings size={14} className="opacity-60" />
      </div>
    </footer>
  )
}

export function AppLoadingSkeleton({
  noteListWidth = 350,
  showNoteList = true,
  showSidebar = true,
  sidebarWidth = 250,
}: AppLoadingSkeletonProps) {
  return (
    <div
      className="app-shell"
      data-testid="vault-loading-skeleton"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading vault</span>
      <div className="app" aria-hidden="true">
        {showSidebar && (
          <>
            <div className="app__sidebar" style={{ width: sidebarWidth }}>
              <SidebarSkeleton />
            </div>
            <div className="w-px shrink-0 bg-border" />
          </>
        )}
        {showNoteList && (
          <>
            <div className="app__note-list" style={{ width: noteListWidth }}>
              <NoteListSkeleton />
            </div>
            <div className="w-px shrink-0 bg-border" />
          </>
        )}
        <div className="app__editor">
          <EditorSkeleton />
        </div>
      </div>
      <StatusSkeleton />
    </div>
  )
}
