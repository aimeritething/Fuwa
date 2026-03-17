import { useState, useRef, useEffect, useCallback } from 'react'
import { EMOJI_CATEGORIES } from '../utils/emoji'

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  onClose: () => void
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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
    // Delay adding the listener to avoid the click that opened the picker from closing it
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler) }
  }, [onClose])

  const handleSelect = useCallback((emoji: string) => {
    onSelect(emoji)
    onClose()
  }, [onSelect, onClose])

  const filteredCategories = search.trim()
    ? [{ name: 'Results', emojis: EMOJI_CATEGORIES.flatMap(c => c.emojis) }]
    : EMOJI_CATEGORIES

  return (
    <div
      ref={containerRef}
      className="absolute z-50 w-[320px] rounded-lg border border-[var(--border-dialog)] bg-popover shadow-lg"
      style={{ left: 54, top: 0 }}
      data-testid="emoji-picker"
    >
      <div className="border-b border-border px-3 py-2">
        <input
          ref={inputRef}
          type="text"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          placeholder="Search emoji..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          data-testid="emoji-picker-search"
        />
      </div>
      {!search.trim() && (
        <div className="flex gap-1 border-b border-border px-3 py-1.5 overflow-x-auto">
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button
              key={cat.name}
              className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] transition-colors ${
                i === activeCategory ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-secondary'
              }`}
              onClick={() => setActiveCategory(i)}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}
      <div className="max-h-[240px] overflow-y-auto p-2" data-testid="emoji-picker-grid">
        {filteredCategories.map((cat, ci) => {
          const show = search.trim() || ci === activeCategory
          if (!show) return null
          return (
            <div key={cat.name}>
              {!search.trim() && (
                <div className="px-1 pb-1 pt-1.5 text-[11px] font-medium text-muted-foreground">
                  {cat.name}
                </div>
              )}
              <div className="grid grid-cols-8 gap-0.5">
                {cat.emojis.map(emoji => (
                  <button
                    key={emoji}
                    className="flex h-8 w-8 items-center justify-center rounded text-xl transition-colors hover:bg-accent"
                    onClick={() => handleSelect(emoji)}
                    data-testid="emoji-option"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
