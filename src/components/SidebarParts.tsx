import { type ComponentType, useState, useEffect, useRef } from 'react'
import type { SidebarSelection } from '../types'
import { cn } from '@/lib/utils'
import { getTypeColor, getTypeLightColor } from '../utils/typeColors'
import { type IconProps } from '@phosphor-icons/react'

export interface SectionGroup {
  label: string
  type: string
  Icon: ComponentType<IconProps>
  customColor?: string | null
}

// eslint-disable-next-line react-refresh/only-export-components -- utility co-located with component
export function isSelectionActive(current: SidebarSelection, check: SidebarSelection): boolean {
  if (current.kind !== check.kind) return false
  switch (check.kind) {
    case 'filter': return (current as typeof check).filter === check.filter
    case 'sectionGroup': return (current as typeof check).type === check.type
    case 'folder': return (current as typeof check).path === check.path
    case 'entity': return (current as typeof check).entry.path === check.entry.path
    case 'view': return (current as typeof check).filename === check.filename
    default: return false
  }
}

// --- NavItem ---

export function NavItem({ icon: Icon, emoji, label, count, isActive, activeClassName = 'bg-primary/10 text-primary', badgeClassName, badgeStyle, activeBadgeClassName, activeBadgeStyle, onClick, disabled, disabledTooltip, compact }: {
  icon: ComponentType<IconProps>
  emoji?: string | null
  label: string
  count?: number
  isActive?: boolean
  activeClassName?: string
  badgeClassName?: string
  badgeStyle?: React.CSSProperties
  activeBadgeClassName?: string
  activeBadgeStyle?: React.CSSProperties
  onClick?: () => void
  disabled?: boolean
  disabledTooltip?: string
  compact?: boolean
}) {
  const iconSize = compact ? 14 : 16
  const textClass = compact ? 'text-[12px]' : 'text-[13px]'
  const padding = compact ? '4px 16px' : '6px 16px'
  const resolvedBadgeClass = isActive && activeBadgeClassName ? activeBadgeClassName : badgeClassName
  const resolvedBadgeStyle = isActive && activeBadgeClassName ? activeBadgeStyle : badgeStyle
  const iconEl = emoji
    ? <span style={{ fontSize: iconSize, lineHeight: 1, width: iconSize, textAlign: 'center' }}>{emoji}</span>
    : <Icon size={iconSize} weight={isActive ? 'fill' : 'regular'} />

  if (disabled) {
    return (
      <div className="flex select-none items-center gap-2 rounded text-foreground" style={{ padding, borderRadius: 4, opacity: 0.4, cursor: 'not-allowed' }} title={disabledTooltip ?? "Coming soon"}>
        {iconEl}
        <span className={cn("flex-1 font-medium", textClass)}>{label}</span>
      </div>
    )
  }
  return (
    <div
      className={cn("flex cursor-pointer select-none items-center gap-2 rounded transition-colors", isActive ? activeClassName : "text-foreground hover:bg-accent")}
      style={{ padding, borderRadius: 4 }}
      onClick={onClick}
    >
      {iconEl}
      <span className={cn("flex-1 font-medium", textClass)}>{label}</span>
      {count !== undefined && count > 0 && (
        <span className={cn("flex items-center justify-center", resolvedBadgeClass)} style={{ height: compact ? 18 : 20, borderRadius: 9999, padding: '0 6px', fontSize: 10, ...resolvedBadgeStyle }}>
          {count}
        </span>
      )}
    </div>
  )
}

// --- Section Content ---

export interface SectionContentProps {
  group: SectionGroup
  itemCount: number
  selection: SidebarSelection
  onSelect: (sel: SidebarSelection) => void
  onContextMenu: (e: React.MouseEvent, type: string) => void
  dragHandleProps?: Record<string, unknown>
  isRenaming?: boolean
  renameInitialValue?: string
  onRenameSubmit?: (value: string) => void
  onRenameCancel?: () => void
}

export function SectionContent({
  group, itemCount, selection, onSelect,
  onContextMenu, dragHandleProps,
  isRenaming, renameInitialValue, onRenameSubmit, onRenameCancel,
}: SectionContentProps) {
  const { label, type, Icon, customColor } = group
  const sectionColor = getTypeColor(type, customColor)
  const sectionLightColor = getTypeLightColor(type, customColor)

  return (
    <SectionHeader
      label={label} type={type} Icon={Icon}
      sectionColor={sectionColor}
      sectionLightColor={sectionLightColor}
      itemCount={itemCount}
      isActive={isSelectionActive(selection, { kind: 'sectionGroup', type })}
      onSelect={() => onSelect({ kind: 'sectionGroup', type })}
      onContextMenu={(e) => onContextMenu(e, type)}
      dragHandleProps={dragHandleProps}
      isRenaming={isRenaming}
      renameInitialValue={renameInitialValue}
      onRenameSubmit={onRenameSubmit}
      onRenameCancel={onRenameCancel}
    />
  )
}

function InlineRenameInput({ initialValue, onSubmit, onCancel }: {
  initialValue: string
  onSubmit: (value: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onSubmit(value.trim()) }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel() }
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onSubmit(value.trim())}
      onClick={(e) => e.stopPropagation()}
      aria-label="Section name"
      className="flex-1 rounded border border-primary bg-background text-[13px] font-medium text-foreground outline-none"
      style={{ padding: '1px 4px' }}
    />
  )
}

function SectionHeader({ label, type, Icon, sectionColor, sectionLightColor, itemCount, isActive, onSelect, onContextMenu, dragHandleProps, isRenaming, renameInitialValue, onRenameSubmit, onRenameCancel }: {
  label: string; type: string; Icon: ComponentType<IconProps>
  sectionColor: string; sectionLightColor: string; itemCount: number; isActive: boolean
  onSelect: () => void; onContextMenu: (e: React.MouseEvent) => void
  dragHandleProps?: Record<string, unknown>
  isRenaming?: boolean; renameInitialValue?: string
  onRenameSubmit?: (value: string) => void; onRenameCancel?: () => void
}) {
  return (
    <div
      className={cn("group/section flex cursor-pointer select-none items-center justify-between rounded transition-colors", !isActive && "hover:bg-accent")}
      style={{ padding: '6px 8px 6px 16px', borderRadius: 4, gap: 4, ...(isActive ? { background: sectionLightColor } : {}) }}
      {...dragHandleProps}
      onClick={() => { if (!isRenaming) onSelect() }}
      onContextMenu={isRenaming ? undefined : onContextMenu}
    >
      <div className="flex min-w-0 flex-1 items-center" style={{ gap: 4 }}>
        <Icon size={16} weight={isActive ? 'fill' : 'regular'} style={{ color: sectionColor, flexShrink: 0 }} />
        {isRenaming && onRenameSubmit && onRenameCancel ? (
          <InlineRenameInput
            key={`rename-${type}`}
            initialValue={renameInitialValue ?? label}
            onSubmit={onRenameSubmit}
            onCancel={onRenameCancel}
          />
        ) : (
          <span className="text-[13px] font-medium" style={{ marginLeft: 4, color: isActive ? sectionColor : undefined }}>{label}</span>
        )}
      </div>
      {itemCount > 0 && (
        <span
          className={cn("flex items-center justify-center", !isActive && "text-muted-foreground")}
          style={{ height: 20, borderRadius: 9999, padding: '0 6px', fontSize: 10, ...(isActive ? { background: sectionColor, color: 'white' } : { background: 'var(--muted)' }) }}
        >
          {itemCount}
        </span>
      )}
    </div>
  )
}

// --- Visibility Popover ---

export function VisibilityPopover({ sections, isSectionVisible, onToggle }: {
  sections: SectionGroup[]
  isSectionVisible: (type: string) => boolean
  onToggle: (type: string) => void
}) {
  return (
    <div
      className="border border-border bg-popover text-popover-foreground"
      style={{ position: 'absolute', top: '100%', left: 6, right: 6, zIndex: 50, borderRadius: 8, padding: '8px 0', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}
    >
      <div className="text-[12px] font-semibold text-muted-foreground" style={{ padding: '0 12px 4px' }}>Show in sidebar</div>
      {sections.map(({ label, type, Icon }) => (
        <button key={type} className="flex w-full cursor-pointer items-center border-none bg-transparent transition-colors hover:bg-accent" style={{ padding: '6px 12px', gap: 8 }} onClick={() => onToggle(type)} aria-label={`Toggle ${label}`}>
          <Icon size={14} style={{ color: getTypeColor(type) }} />
          <span className="flex-1 text-left text-[13px] text-foreground">{label}</span>
          <ToggleSwitch on={isSectionVisible(type)} />
        </button>
      ))}
    </div>
  )
}

function ToggleSwitch({ on }: { on: boolean }) {
  return (
    <div className="flex items-center" style={{ width: 32, height: 18, borderRadius: 9, padding: 2, backgroundColor: on ? 'var(--primary)' : 'var(--muted)', justifyContent: on ? 'flex-end' : 'flex-start', transition: 'background-color 150ms' }}>
      <div style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: 'white', transition: 'transform 150ms' }} />
    </div>
  )
}
