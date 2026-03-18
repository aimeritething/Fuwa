import { useState, useRef, useEffect, useCallback } from 'react'
import { EMOJI_GROUPS, EMOJIS_BY_GROUP, GROUP_ICONS, GROUP_SHORT_LABELS, searchEmojis } from '../utils/emoji'

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  onClose: () => void
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const groupRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [onClose])

  // Close when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler) }
  }, [onClose])

  const handleSelect = useCallback((emoji: string) => {
    onSelect(emoji)
    onClose()
  }, [onSelect, onClose])

  const scrollToGroup = useCallback((group: string) => {
    const el = groupRefs.current.get(group)
    if (el && scrollRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const searchResults = search.trim() ? searchEmojis(search) : null
  const isSearching = searchResults !== null

  return (
    <div
      ref={containerRef}
      className="absolute z-50 w-[340px] rounded-lg border border-[var(--border-dialog)] bg-popover shadow-lg"
      style={{ left: 54, top: 0 }}
      data-testid="emoji-picker"
    >
      <div className="border-b border-border px-3 py-2">
        <input
          ref={inputRef}
          type="text"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          placeholder="Search emoji by name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          data-testid="emoji-picker-search"
        />
      </div>
      {!isSearching && (
        <div className="flex gap-0.5 border-b border-border px-2 py-1.5 overflow-x-auto">
          {EMOJI_GROUPS.map(group => (
            <button
              key={group}
              className="shrink-0 rounded px-1.5 py-1 text-base transition-colors hover:bg-secondary"
              onClick={() => scrollToGroup(group)}
              title={GROUP_SHORT_LABELS[group]}
            >
              {GROUP_ICONS[group]}
            </button>
          ))}
        </div>
      )}
      <div ref={scrollRef} className="max-h-[300px] overflow-y-auto p-2" data-testid="emoji-picker-grid">
        {isSearching ? (
          searchResults.length > 0 ? (
            <div className="grid grid-cols-8 gap-0.5">
              {searchResults.map(entry => (
                <button
                  key={entry.emoji}
                  className="flex h-8 w-8 items-center justify-center rounded text-xl transition-colors hover:bg-accent"
                  onClick={() => handleSelect(entry.emoji)}
                  title={entry.name}
                  data-testid="emoji-option"
                >
                  {entry.emoji}
                </button>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No emojis found
            </div>
          )
        ) : (
          EMOJI_GROUPS.map(group => {
            const emojis = EMOJIS_BY_GROUP.get(group)
            if (!emojis?.length) return null
            return (
              <div
                key={group}
                ref={el => { if (el) groupRefs.current.set(group, el) }}
              >
                <div className="sticky top-0 z-10 bg-popover px-1 pb-1 pt-2 text-[11px] font-medium text-muted-foreground">
                  {GROUP_SHORT_LABELS[group]}
                </div>
                <div className="grid grid-cols-8 gap-0.5">
                  {emojis.map(entry => (
                    <button
                      key={entry.emoji}
                      className="flex h-8 w-8 items-center justify-center rounded text-xl transition-colors hover:bg-accent"
                      onClick={() => handleSelect(entry.emoji)}
                      title={entry.name}
                      data-testid="emoji-option"
                    >
                      {entry.emoji}
                    </button>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
