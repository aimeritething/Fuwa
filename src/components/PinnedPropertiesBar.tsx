import { memo, useRef, useState, useCallback, useEffect } from 'react'
import type { VaultEntry } from '../types'
import type { FrontmatterValue } from './Inspector'
import type { ParsedFrontmatter } from '../utils/frontmatter'
import { usePinnedProperties, type ResolvedPinnedProperty } from '../hooks/usePinnedProperties'
import { PinnedPropertyChip } from './PinnedPropertyChip'
import { DotsThree } from '@phosphor-icons/react'

export const PinnedPropertiesBar = memo(function PinnedPropertiesBar({ entry, entries, frontmatter, onUpdateFrontmatter, onNavigate }: {
  entry: VaultEntry
  entries: VaultEntry[]
  frontmatter: ParsedFrontmatter
  onUpdateFrontmatter?: (path: string, key: string, value: FrontmatterValue) => Promise<void>
  onNavigate?: (target: string) => void
}) {
  const { resolved } = usePinnedProperties({ entry, entries, frontmatter, onUpdateTypeFrontmatter: onUpdateFrontmatter })

  const containerRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(resolved.length)
  const [showOverflow, setShowOverflow] = useState(false)

  const measureOverflow = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const items = Array.from(el.querySelectorAll<HTMLElement>('[data-pinchip]'))
    if (items.length === 0) { setVisibleCount(0); return }
    const containerRight = el.getBoundingClientRect().right - 48
    let count = 0
    for (const child of items) {
      if (child.getBoundingClientRect().right <= containerRight) count++
      else break
    }
    setVisibleCount(Math.max(count, 1))
  }, [])

  useEffect(() => {
    // Defer measurement to avoid synchronous setState in effect
    requestAnimationFrame(measureOverflow)
    const observer = new ResizeObserver(measureOverflow)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [measureOverflow, resolved.length])

  if (resolved.length === 0) return null

  const handleSave = (key: string, value: string) => {
    onUpdateFrontmatter?.(entry.path, key, value)
  }

  const hiddenCount = resolved.length - visibleCount

  return (
    <div
      ref={containerRef}
      className="flex items-start overflow-hidden"
      style={{ gap: 16, padding: '8px 0', position: 'relative' }}
      data-testid="pinned-properties-bar"
    >
      {resolved.map((p, i) => (
        <div key={p.key} data-pinchip style={i >= visibleCount ? { visibility: 'hidden', position: 'absolute' } : undefined}>
          <PinnedPropertyChip
            propKey={p.key} label={p.label} value={p.value} icon={p.icon}
            isRelationship={p.isRelationship}
            onSave={handleSave} onNavigate={onNavigate}
          />
        </div>
      ))}
      {hiddenCount > 0 && (
        <OverflowPopover
          count={hiddenCount}
          items={resolved.slice(visibleCount)}
          open={showOverflow}
          onToggle={() => setShowOverflow((v) => !v)}
          onSave={handleSave}
          onNavigate={onNavigate}
        />
      )}
    </div>
  )
})

function OverflowPopover({ count, items, open, onToggle, onSave, onNavigate }: {
  count: number
  items: ResolvedPinnedProperty[]
  open: boolean
  onToggle: () => void
  onSave: (key: string, value: string) => void
  onNavigate?: (target: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onToggle])

  return (
    <div ref={ref} className="relative shrink-0 self-end">
      <button
        className="flex items-center gap-1 rounded border-none bg-transparent cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
        style={{ padding: '3px 6px', fontSize: 12 }}
        onClick={onToggle}
        title={`${count} more properties`}
      >
        <DotsThree weight="bold" width={16} height={16} />
        <span>+{count}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 flex flex-wrap gap-4 rounded-lg border border-border bg-popover p-3 shadow-md" style={{ minWidth: 200, maxWidth: 400 }}>
          {items.map((p) => (
            <PinnedPropertyChip
              key={p.key} propKey={p.key} label={p.label} value={p.value} icon={p.icon}
              isRelationship={p.isRelationship}
              onSave={onSave} onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  )
}
