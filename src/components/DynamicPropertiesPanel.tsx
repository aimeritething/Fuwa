import { useState, useCallback, useRef, useEffect } from 'react'
import type { VaultEntry } from '../types'
import type { FrontmatterValue } from './Inspector'
import type { ParsedFrontmatter } from '../utils/frontmatter'
import { usePropertyPanelState } from '../hooks/usePropertyPanelState'
import { getEffectiveDisplayMode, detectPropertyType } from '../utils/propertyTypes'
import { SmartPropertyValueCell, DisplayModeSelector } from './PropertyValueCells'
import { TypeSelector } from './TypeSelector'
import { AddPropertyForm } from './AddPropertyForm'
import { countWords } from '../utils/wikilinks'
import type { PropertyDisplayMode } from '../utils/propertyTypes'
import { PushPin } from '@phosphor-icons/react'

// eslint-disable-next-line react-refresh/only-export-components -- utility co-located with component
export function containsWikilinks(value: FrontmatterValue): boolean {
  if (typeof value === 'string') return /^\[\[.*\]\]$/.test(value)
  if (Array.isArray(value)) return value.some(v => typeof v === 'string' && /^\[\[.*\]\]$/.test(v))
  return false
}

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

function PropertyPinMenu({ x, y, isPinned, onPin, onUnpin, onClose }: {
  x: number; y: number; isPinned: boolean
  onPin: () => void; onUnpin: () => void; onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="fixed z-50 flex flex-col rounded-lg border border-border bg-popover shadow-lg"
      style={{ left: x, top: y, minWidth: 160, padding: 4 }}
      data-testid="property-context-menu"
    >
      <button
        className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-accent"
        style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
        onClick={() => { if (isPinned) { onUnpin() } else { onPin() } onClose() }}
      >
        <PushPin size={14} />
        {isPinned ? 'Unpin from editor' : 'Pin to editor'}
      </button>
    </div>
  )
}

function PropertyRow({ propKey, value, editingKey, displayMode, autoMode, vaultStatuses, vaultTags, isPinned, onStartEdit, onSave, onSaveList, onUpdate, onDelete, onDisplayModeChange, onPin, onUnpin }: {
  propKey: string; value: FrontmatterValue; editingKey: string | null
  displayMode: PropertyDisplayMode; autoMode: PropertyDisplayMode
  vaultStatuses: string[]; vaultTags: string[]
  isPinned: boolean
  onStartEdit: (key: string | null) => void; onSave: (key: string, value: string) => void
  onSaveList: (key: string, items: string[]) => void
  onUpdate?: (key: string, value: FrontmatterValue) => void; onDelete?: (key: string) => void
  onDisplayModeChange: (key: string, mode: PropertyDisplayMode | null) => void
  onPin?: (key: string) => void; onUnpin?: (key: string) => void
}) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && editingKey !== propKey) {
      e.preventDefault()
      onStartEdit(propKey)
    }
  }

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (!onPin && !onUnpin) return
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }, [onPin, onUnpin])

  return (
    <div
      className="group/prop grid min-w-0 grid-cols-2 items-center gap-2 rounded px-1.5 outline-none transition-colors hover:bg-muted focus:bg-muted focus:ring-1 focus:ring-primary"
      style={isPinned ? { backgroundColor: 'color-mix(in srgb, var(--primary) 5%, transparent)' } : undefined}
      tabIndex={0} onKeyDown={handleKeyDown} onContextMenu={handleContextMenu}
      data-testid="editable-property"
    >
      <span className="font-mono-overline flex min-w-0 items-center gap-1 text-muted-foreground">
        {isPinned && <PushPin size={10} className="shrink-0 text-primary" style={{ opacity: 0.6 }} />}
        <span className="truncate">{propKey}</span>
        {onDelete && (
          <button className="border-none bg-transparent p-0 text-sm leading-none text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover/prop:opacity-100" onClick={() => onDelete(propKey)} title="Delete property">&times;</button>
        )}
        <DisplayModeSelector propKey={propKey} currentMode={displayMode} autoMode={autoMode} onSelect={onDisplayModeChange} />
      </span>
      <div className="min-w-0">
        <SmartPropertyValueCell propKey={propKey} value={value} displayMode={displayMode} isEditing={editingKey === propKey} vaultStatuses={vaultStatuses} vaultTags={vaultTags} onStartEdit={onStartEdit} onSave={onSave} onSaveList={onSaveList} onUpdate={onUpdate} />
      </div>
      {ctxMenu && (
        <PropertyPinMenu
          x={ctxMenu.x} y={ctxMenu.y} isPinned={isPinned}
          onPin={() => onPin?.(propKey)} onUnpin={() => onUnpin?.(propKey)}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 grid-cols-2 items-center gap-2 px-1.5" data-testid="readonly-property">
      <span className="font-mono-overline min-w-0 truncate" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="min-w-0 truncate text-right text-[12px]" style={{ color: 'var(--text-muted)' }}>{value}</span>
    </div>
  )
}

function AddPropertyButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      className="mt-3 w-full cursor-pointer border border-border bg-transparent text-center text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
      style={{ borderRadius: 6, padding: '6px 12px', fontSize: 12 }}
      onClick={onClick} disabled={disabled}
    >+ Add property</button>
  )
}

function NoteInfoSection({ entry, wordCount }: { entry: VaultEntry; wordCount: number }) {
  return (
    <div className="border-t border-border pt-3">
      <h4 className="font-mono-overline mb-2 text-muted-foreground">Info</h4>
      <div className="flex flex-col gap-1.5">
        <InfoRow label="Modified" value={formatDate(entry.modifiedAt)} />
        <InfoRow label="Created" value={formatDate(entry.createdAt)} />
        <InfoRow label="Words" value={String(wordCount)} />
        <InfoRow label="Size" value={formatFileSize(entry.fileSize)} />
      </div>
    </div>
  )
}

export function DynamicPropertiesPanel({
  entry, content, frontmatter, entries,
  onUpdateProperty, onDeleteProperty, onAddProperty, onNavigate,
  isPinned, onPin, onUnpin,
}: {
  entry: VaultEntry
  content: string | null
  frontmatter: ParsedFrontmatter
  entries?: VaultEntry[]
  onUpdateProperty?: (key: string, value: FrontmatterValue) => void
  onDeleteProperty?: (key: string) => void
  onAddProperty?: (key: string, value: FrontmatterValue) => void
  onNavigate?: (target: string) => void
  isPinned?: (key: string) => boolean
  onPin?: (key: string) => void
  onUnpin?: (key: string) => void
}) {
  const {
    editingKey, setEditingKey, showAddDialog, setShowAddDialog, displayOverrides,
    availableTypes, customColorKey, typeColorKeys, typeIconKeys, vaultStatuses, vaultTagsByKey, propertyEntries,
    handleSaveValue, handleSaveList, handleAdd, handleDisplayModeChange,
  } = usePropertyPanelState({ entries, entryIsA: entry.isA, frontmatter, onUpdateProperty, onDeleteProperty, onAddProperty })

  const wordCount = countWords(content ?? '')

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <TypeSelector isA={entry.isA} customColorKey={customColorKey} availableTypes={availableTypes} typeColorKeys={typeColorKeys} typeIconKeys={typeIconKeys} onUpdateProperty={onUpdateProperty} onNavigate={onNavigate} />
        {propertyEntries.map(([key, value]) => (
          <PropertyRow
            key={key} propKey={key} value={value}
            editingKey={editingKey} displayMode={getEffectiveDisplayMode(key, value, displayOverrides)} autoMode={detectPropertyType(key, value)}
            vaultStatuses={vaultStatuses}
            vaultTags={vaultTagsByKey[key] ?? []}
            isPinned={isPinned?.(key) ?? false}
            onStartEdit={setEditingKey} onSave={handleSaveValue}
            onSaveList={handleSaveList} onUpdate={onUpdateProperty}
            onDelete={onDeleteProperty}
            onDisplayModeChange={handleDisplayModeChange}
            onPin={onPin} onUnpin={onUnpin}
          />
        ))}
      </div>
      {showAddDialog
        ? <AddPropertyForm onAdd={handleAdd} onCancel={() => setShowAddDialog(false)} vaultStatuses={vaultStatuses} />
        : <AddPropertyButton onClick={() => setShowAddDialog(true)} disabled={!onAddProperty} />
      }
      <NoteInfoSection entry={entry} wordCount={wordCount} />
    </div>
  )
}
