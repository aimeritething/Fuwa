import type { VaultEntry } from '../../types'
import { getTypeColor, getTypeLightColor } from '../../utils/typeColors'
import { getTypeIcon } from '../NoteItem'
import { relativeDate, getDisplayDate } from '../../utils/noteListHelpers'

export function PinnedCard({ entry, typeEntryMap, onClickNote, showDate }: {
  entry: VaultEntry
  typeEntryMap: Record<string, VaultEntry>
  onClickNote: (entry: VaultEntry, e: React.MouseEvent) => void
  showDate?: boolean
}) {
  const te = typeEntryMap[entry.isA ?? '']
  const color = getTypeColor(entry.isA ?? '', te?.color)
  const bgColor = getTypeLightColor(entry.isA ?? '', te?.color)
  const Icon = getTypeIcon(entry.isA, te?.icon)
  return (
    <div className="relative cursor-pointer border-b border-[var(--border)]" style={{ backgroundColor: bgColor, padding: '14px 16px' }} onClick={(e: React.MouseEvent) => onClickNote(entry, e)}>
      {/* eslint-disable-next-line react-hooks/static-components */}
      <Icon width={16} height={16} className="absolute right-3 top-3.5" style={{ color }} data-testid="type-icon" />
      <div className="pr-6 text-[14px] font-bold" style={{ color }}>{entry.title}</div>
      <div className="mt-1 text-[12px] leading-[1.5] opacity-80" style={{ color, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{entry.snippet}</div>
      {showDate && <div className="mt-1 text-[11px] opacity-60" style={{ color }}>{relativeDate(getDisplayDate(entry))}</div>}
    </div>
  )
}
