import type { VaultEntry } from '../../types'
import { Info } from '@phosphor-icons/react'
import { countWords } from '../../utils/wikilinks'

function formatDate(timestamp: number | null): string {
  if (!timestamp) return '\u2014'
  const d = new Date(timestamp * 1000)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(1)} MB`
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 grid-cols-2 items-center gap-2 px-1.5" data-testid="readonly-property">
      <span className="min-w-0 truncate text-[12px] text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right text-[12px]" style={{ color: 'var(--text-muted)' }}>{value}</span>
    </div>
  )
}

export function NoteInfoPanel({ entry, content }: { entry: VaultEntry; content: string | null }) {
  const wordCount = countWords(content ?? '')
  return (
    <div>
      <h4 className="font-mono-overline mb-2 flex items-center gap-1 text-muted-foreground">
        <Info size={12} className="shrink-0" />
        Info
      </h4>
      <div className="flex flex-col gap-1.5">
        <InfoRow label="Modified" value={formatDate(entry.modifiedAt)} />
        <InfoRow label="Created" value={formatDate(entry.createdAt)} />
        <InfoRow label="Words" value={String(wordCount)} />
        <InfoRow label="Size" value={formatFileSize(entry.fileSize)} />
      </div>
    </div>
  )
}
