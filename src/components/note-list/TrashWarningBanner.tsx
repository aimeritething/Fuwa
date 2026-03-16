import { Warning, TrashSimple } from '@phosphor-icons/react'

export function TrashWarningBanner({ expiredCount }: { expiredCount: number }) {
  if (expiredCount === 0) return null
  return (
    <div className="flex items-start gap-2 border-b border-[var(--border)]" style={{ padding: '10px 12px', background: 'color-mix(in srgb, var(--destructive) 6%, transparent)' }}>
      <Warning size={16} className="shrink-0" style={{ color: 'var(--destructive)', marginTop: 1 }} />
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--destructive)' }}>Notes in trash for 30+ days will be permanently deleted</div>
        <div className="text-muted-foreground" style={{ fontSize: 11 }}>{expiredCount} {expiredCount === 1 ? 'note is' : 'notes are'} past the 30-day retention period</div>
      </div>
    </div>
  )
}

export function EmptyMessage({ text }: { text: string }) {
  return <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">{text}</div>
}

export function DeletedNotesBanner({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <div className="flex items-center gap-2 border-b border-[var(--border)] opacity-60" style={{ padding: '14px 16px' }} data-testid="deleted-notes-banner">
      <TrashSimple size={14} className="shrink-0 text-muted-foreground" />
      <span className="text-[13px] text-muted-foreground">{count} {count === 1 ? 'note' : 'notes'} deleted</span>
    </div>
  )
}
