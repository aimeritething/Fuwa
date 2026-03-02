import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { preFilterWikilinks, deduplicateByPath, MIN_QUERY_LENGTH } from '../utils/wikilinkSuggestions'
import { attachClickHandlers, enrichSuggestionItems } from '../utils/suggestionEnrichment'
import { buildTypeEntryMap } from '../utils/typeColors'
import { NoteSearchList } from './NoteSearchList'
import { extractWikilinkQuery, detectYamlError } from '../utils/rawEditorUtils'
import type { WikilinkSuggestionItem } from './WikilinkSuggestionMenu'
import type { VaultEntry } from '../types'

/** Get approximate pixel coordinates of the cursor in a textarea. */
function getCaretCoordinates(
  textarea: HTMLTextAreaElement,
  position: number,
): { top: number; left: number } {
  const mirror = document.createElement('div')
  const style = getComputedStyle(textarea)

  const props = [
    'boxSizing', 'width', 'borderTopWidth', 'borderRightWidth',
    'borderBottomWidth', 'borderLeftWidth',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'fontStyle', 'fontVariant', 'fontWeight', 'fontSize', 'lineHeight',
    'fontFamily', 'textTransform', 'letterSpacing', 'wordSpacing',
  ] as const
  for (const prop of props) {
    (mirror.style as unknown as Record<string, string>)[prop] = style[prop] as string
  }
  mirror.style.position = 'absolute'
  mirror.style.visibility = 'hidden'
  mirror.style.top = '0'
  mirror.style.left = '-9999px'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.wordWrap = 'break-word'
  mirror.style.overflow = 'hidden'

  mirror.textContent = textarea.value.slice(0, position)
  const caret = document.createElement('span')
  caret.textContent = '\u200B'
  mirror.appendChild(caret)
  document.body.appendChild(mirror)

  const caretRect = caret.getBoundingClientRect()
  const mirrorRect = mirror.getBoundingClientRect()
  document.body.removeChild(mirror)

  const textareaRect = textarea.getBoundingClientRect()
  return {
    top: caretRect.top - mirrorRect.top + textareaRect.top - textarea.scrollTop,
    left: caretRect.left - mirrorRect.left + textareaRect.left,
  }
}

interface AutocompleteState {
  caretTop: number
  caretLeft: number
  selectedIndex: number
  items: WikilinkSuggestionItem[]
}

interface RawEditorViewProps {
  content: string
  path: string
  entries: VaultEntry[]
  onContentChange: (path: string, content: string) => void
  onSave: () => void
}

const FONT_FAMILY = '"Berkeley Mono", "JetBrains Mono", "Fira Mono", ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
const DEBOUNCE_MS = 500
const DROPDOWN_MAX_HEIGHT = 200

export function RawEditorView({ content, path, entries, onContentChange, onSave }: RawEditorViewProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pathRef = useRef(path)
  const onContentChangeRef = useRef(onContentChange)
  const onSaveRef = useRef(onSave)
  useEffect(() => { pathRef.current = path }, [path])
  useEffect(() => { onContentChangeRef.current = onContentChange }, [onContentChange])
  useEffect(() => { onSaveRef.current = onSave }, [onSave])

  const [value, setValue] = useState(content)
  const [autocomplete, setAutocomplete] = useState<AutocompleteState | null>(null)
  const [yamlError, setYamlError] = useState<string | null>(() => detectYamlError(content))
  // NOTE: tab-switch reset is handled via key={path} in the parent (EditorContent)

  const typeEntryMap = useMemo(() => buildTypeEntryMap(entries), [entries])

  const baseItems = useMemo(
    () => deduplicateByPath(entries.map(entry => ({
      title: entry.title,
      aliases: [...new Set([entry.filename.replace(/\.md$/, ''), ...entry.aliases])],
      group: entry.isA || 'Note',
      entryTitle: entry.title,
      path: entry.path,
    }))),
    [entries],
  )

  /** Insert [[entryTitle]] at the current [[ trigger position */
  const insertWikilink = useCallback((entryTitle: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursor = textarea.selectionStart
    const text = textarea.value
    const before = text.slice(0, cursor)
    const triggerIdx = before.lastIndexOf('[[')
    if (triggerIdx === -1) return

    const after = text.slice(cursor)
    const newText = `${text.slice(0, triggerIdx)}[[${entryTitle}]]${after}`
    const newCursor = triggerIdx + entryTitle.length + 4

    setValue(newText)
    setAutocomplete(null)

    // Flush immediately — autocomplete inserts should not be debounced
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = null
    onContentChangeRef.current(pathRef.current, newText)

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = newCursor
        textareaRef.current.selectionEnd = newCursor
        textareaRef.current.focus()
      }
    })
  }, [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const cursor = e.target.selectionStart ?? 0

    setValue(newValue)
    setYamlError(detectYamlError(newValue))

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onContentChangeRef.current(pathRef.current, newValue)
    }, DEBOUNCE_MS)

    const query = extractWikilinkQuery(newValue, cursor)
    if (query === null || query.length < MIN_QUERY_LENGTH) {
      setAutocomplete(null)
      return
    }

    const textarea = e.target
    const coords = getCaretCoordinates(textarea, cursor)
    const candidates = preFilterWikilinks(baseItems, query)
    const withHandlers = attachClickHandlers(candidates, insertWikilink)
    const items = enrichSuggestionItems(withHandlers, query, typeEntryMap)

    setAutocomplete({ caretTop: coords.top, caretLeft: coords.left, selectedIndex: 0, items })
  }, [baseItems, typeEntryMap, insertWikilink])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Save shortcut
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
        onContentChangeRef.current(pathRef.current, textareaRef.current?.value ?? '')
      }
      onSaveRef.current()
      return
    }

    if (!autocomplete) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAutocomplete(prev => prev
        ? { ...prev, selectedIndex: Math.min(prev.selectedIndex + 1, prev.items.length - 1) }
        : null)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAutocomplete(prev => prev
        ? { ...prev, selectedIndex: Math.max(prev.selectedIndex - 1, 0) }
        : null)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = autocomplete.items[autocomplete.selectedIndex]
      if (item) insertWikilink(item.entryTitle ?? item.title)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setAutocomplete(null)
    }
  }, [autocomplete, insertWikilink])

  const closeAutocomplete = useCallback(() => setAutocomplete(null), [])

  // Flush pending debounce on unmount (e.g. switching tabs while in raw mode)
  useEffect(() => {
    const pendingPath = pathRef
    const pendingChange = onContentChangeRef
    const pendingDebounce = debounceRef
    const pendingTextarea = textareaRef
    return () => {
      if (pendingDebounce.current) {
        clearTimeout(pendingDebounce.current)
        pendingChange.current(pendingPath.current, pendingTextarea.current?.value ?? '')
      }
    }
  }, [])

  const dropdownBelow = autocomplete
    ? autocomplete.caretTop + 20 + DROPDOWN_MAX_HEIGHT <= window.innerHeight
    : true
  const dropdownTop = autocomplete
    ? (dropdownBelow ? autocomplete.caretTop + 20 : autocomplete.caretTop - DROPDOWN_MAX_HEIGHT - 4)
    : 0
  const dropdownLeft = autocomplete
    ? Math.min(autocomplete.caretLeft, window.innerWidth - 260)
    : 0

  return (
    <div className="flex flex-1 flex-col min-h-0 relative" style={{ background: 'var(--background)' }}>
      {yamlError && (
        <div
          className="flex items-center gap-2 px-4 py-2 text-xs border-b shrink-0"
          style={{ background: '#fef3c7', borderColor: '#d97706', color: '#92400e' }}
          role="alert"
          data-testid="raw-editor-yaml-error"
        >
          <span style={{ fontWeight: 600 }}>YAML error:</span>
          <span>{yamlError}</span>
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={closeAutocomplete}
        className="flex-1 resize-none border-none outline-none p-8"
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 13,
          lineHeight: 1.6,
          background: 'var(--background)',
          color: 'var(--foreground)',
          tabSize: 2,
          minHeight: 0,
        }}
        spellCheck={false}
        aria-label="Raw editor"
        data-testid="raw-editor-textarea"
      />
      {autocomplete && autocomplete.items.length > 0 && (
        <div
          className="fixed z-50 min-w-64 max-w-xs rounded-md border shadow-lg overflow-auto"
          style={{
            top: dropdownTop,
            left: dropdownLeft,
            maxHeight: DROPDOWN_MAX_HEIGHT,
            background: 'var(--popover)',
            borderColor: 'var(--border)',
          }}
          data-testid="raw-editor-wikilink-dropdown"
        >
          <NoteSearchList
            items={autocomplete.items}
            selectedIndex={autocomplete.selectedIndex}
            getItemKey={(item, i) => `${item.title}-${item.path ?? i}`}
            onItemClick={(item) => insertWikilink(item.entryTitle ?? item.title)}
            onItemHover={(i) => setAutocomplete(prev => prev ? { ...prev, selectedIndex: i } : null)}
          />
        </div>
      )}
    </div>
  )
}
