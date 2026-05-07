import { useRef, useEffect, type ComponentType, type SVGAttributes } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { scrollSelectedHTMLChildIntoView } from '../utils/domScroll'
import { NoteTitleIcon } from './NoteTitleIcon'

export interface NoteSearchResultItem {
  title: string
  noteIcon?: string | null
  noteType?: string
  typeColor?: string
  typeLightColor?: string
  TypeIcon?: ComponentType<SVGAttributes<SVGSVGElement>>
}

interface NoteSearchListProps<T extends NoteSearchResultItem> {
  items: T[]
  selectedIndex: number
  getItemKey: (item: T, index: number) => string
  onItemClick: (item: T, index: number) => void
  onItemHover?: (index: number) => void
  emptyMessage?: string
  className?: string
}

interface NoteSearchListItemProps<T extends NoteSearchResultItem> {
  item: T
  index: number
  selected: boolean
  onItemClick: (item: T, index: number) => void
  onItemHover?: (index: number) => void
}

function NoteSearchListItem<T extends NoteSearchResultItem>({
  item,
  index,
  selected,
  onItemClick,
  onItemHover,
}: NoteSearchListItemProps<T>) {
  return (
    <div
      className={cn(
        'flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 transition-colors',
        selected ? 'bg-accent' : 'hover:bg-secondary',
      )}
      onClick={() => onItemClick(item, index)}
      onMouseEnter={() => onItemHover?.(index)}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm text-foreground">
        {item.TypeIcon && (
          <item.TypeIcon
            width={14}
            height={14}
            className="shrink-0"
            style={item.typeColor ? { color: item.typeColor } : undefined}
          />
        )}
        <NoteTitleIcon icon={item.noteIcon} size={14} testId="note-search-item-icon" />
        <span className="truncate">{item.title}</span>
      </span>
      {item.noteType && (
        <Badge
          variant="secondary"
          className="shrink-0 text-[11px]"
          style={item.typeColor ? { color: item.typeColor, backgroundColor: item.typeLightColor } : undefined}
        >
          {item.noteType}
        </Badge>
      )}
    </div>
  )
}

export function NoteSearchList<T extends NoteSearchResultItem>({
  items,
  selectedIndex,
  getItemKey,
  onItemClick,
  onItemHover,
  emptyMessage = 'No results',
  className,
}: NoteSearchListProps<T>) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollSelectedHTMLChildIntoView(listRef.current, selectedIndex)
  }, [selectedIndex])

  if (items.length === 0) {
    return (
      <div ref={listRef} className={cn('py-1', className)}>
        <div className="px-4 py-3 text-center text-[13px] text-muted-foreground">
          {emptyMessage}
        </div>
      </div>
    )
  }

  return (
    <div ref={listRef} className={cn('py-1', className)}>
      {items.map((item, i) => (
        <NoteSearchListItem
          key={getItemKey(item, i)}
          item={item}
          index={i}
          selected={i === selectedIndex}
          onItemClick={onItemClick}
          onItemHover={onItemHover}
        />
      ))}
    </div>
  )
}
