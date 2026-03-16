import { useState, useCallback, useRef, useEffect } from 'react'
import { slugify } from '../hooks/useNoteCreation'

interface TitleFieldProps {
  title: string
  filename: string
  editable?: boolean
  /** Called when the user finishes editing the title (blur or Enter). */
  onTitleChange: (newTitle: string) => void
}

/**
 * Dedicated title input field above the editor.
 * Displays the title as an editable field and shows the resulting filename below.
 * Replaces the H1 block as the primary title editing surface.
 */
export function TitleField({ title, filename, editable = true, onTitleChange }: TitleFieldProps) {
  const [localValue, setLocalValue] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isFocusedRef = useRef(false)

  // The displayed value: use local edit value while focused, otherwise prop title
  const value = localValue ?? title

  // Listen for laputa:focus-editor with selectTitle to focus this field
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.selectTitle && inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select()
      }
    }
    window.addEventListener('laputa:focus-editor', handler)
    return () => window.removeEventListener('laputa:focus-editor', handler)
  }, [])

  const handleFocus = useCallback(() => {
    isFocusedRef.current = true
    setLocalValue(title)
  }, [title])

  const commitTitle = useCallback(() => {
    isFocusedRef.current = false
    const trimmed = (localValue ?? '').trim()
    if (trimmed && trimmed !== title) {
      onTitleChange(trimmed)
    }
    setLocalValue(null) // reset to prop-driven
  }, [localValue, title, onTitleChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      inputRef.current?.blur()
    }
    if (e.key === 'Escape') {
      setLocalValue(null) // revert to prop
      inputRef.current?.blur()
    }
  }, [])

  const expectedSlug = slugify(value.trim() || title)
  const currentStem = filename.replace(/\.md$/, '')
  const showFilename = localValue !== null || currentStem !== expectedSlug

  return (
    <div className="title-field" data-testid="title-field">
      <input
        ref={inputRef}
        className="title-field__input"
        value={value}
        onChange={e => setLocalValue(e.target.value)}
        onFocus={handleFocus}
        onBlur={commitTitle}
        onKeyDown={handleKeyDown}
        disabled={!editable}
        placeholder="Untitled"
        spellCheck={false}
        data-testid="title-field-input"
      />
      {showFilename && (
        <span className="title-field__filename" data-testid="title-field-filename">
          {expectedSlug}.md
        </span>
      )}
    </div>
  )
}
