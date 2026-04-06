import { memo } from 'react'
import { Archive, ArrowCounterClockwise, Trash, X } from '@phosphor-icons/react'

interface BulkActionBarProps {
  count: number
  isArchivedView?: boolean
  onArchive: () => void
  onDelete: () => void
  onUnarchive?: () => void
  onClear: () => void
}

const actionBtnStyle = { padding: '5px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.12)', color: 'inherit', fontSize: 12, fontWeight: 500 } as const
const destructiveBtnStyle = { padding: '5px 10px', borderRadius: 6, background: 'rgba(224,62,62,0.2)', color: 'var(--destructive)', fontSize: 12, fontWeight: 500 } as const

function renderArchivedActions(onUnarchive: (() => void) | undefined, onDelete: () => void) {
  return (
    <>
      <button className="flex items-center gap-1.5 border-none bg-transparent cursor-pointer" style={actionBtnStyle} onClick={onUnarchive} title="Unarchive selected notes" data-testid="bulk-unarchive-btn">
        <ArrowCounterClockwise size={14} /> Unarchive
      </button>
      <button className="flex items-center gap-1.5 border-none cursor-pointer" style={destructiveBtnStyle} onClick={onDelete} title="Permanently delete selected notes" data-testid="bulk-delete-btn">
        <Trash size={14} /> Delete
      </button>
    </>
  )
}

function renderDefaultActions(onArchive: () => void, onDelete: () => void) {
  return (
    <>
      <button className="flex items-center gap-1.5 border-none bg-transparent cursor-pointer" style={actionBtnStyle} onClick={onArchive} title="Archive selected notes" data-testid="bulk-archive-btn">
        <Archive size={14} /> Archive
      </button>
      <button className="flex items-center gap-1.5 border-none cursor-pointer" style={destructiveBtnStyle} onClick={onDelete} title="Permanently delete selected notes" data-testid="bulk-delete-btn">
        <Trash size={14} /> Delete
      </button>
    </>
  )
}

function BulkActionBarInner({ count, isArchivedView, onArchive, onDelete, onUnarchive, onClear }: BulkActionBarProps) {
  return (
    <div
      className="flex shrink-0 items-center justify-between"
      style={{
        height: 44,
        padding: '0 12px',
        background: 'var(--foreground)',
        color: 'var(--background)',
      }}
      data-testid="bulk-action-bar"
    >
      <span style={{ fontSize: 13, fontWeight: 500 }}>
        {count} selected
      </span>
      <div className="flex items-center gap-1">
        {isArchivedView ? renderArchivedActions(onUnarchive, onDelete)
          : renderDefaultActions(onArchive, onDelete)}
        <button
          className="flex items-center border-none bg-transparent cursor-pointer"
          style={{ padding: '5px 6px', color: 'rgba(255,255,255,0.5)' }}
          onClick={onClear}
          title="Clear selection"
          data-testid="bulk-clear-btn"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

export const BulkActionBar = memo(BulkActionBarInner)
