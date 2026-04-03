import { useState, useCallback, useRef, useEffect } from 'react'
import { slugify } from '../hooks/useNoteCreation'

interface TitleFieldProps {
  title: string
  filename: string
  editable?: boolean
  /** Absolute path of the note file. */
  notePath?: string
  /** Absolute path of the vault root. */
  vaultPath?: string
  /** Called when the user finishes editing the title (blur or Enter). */
  onTitleChange: (newTitle: string) => void
}

/** Manages local edit + optimistic title state for TitleField. */
function useOptimisticTitle(title: string, onTitleChange: (t: string) => void) {
  const [localValue, setLocalValue] = useState<string | null>(null)
  // [optimisticTitle, forPropTitle]: shown after commit until title prop catches up
  const [optimistic, setOptimistic] = useState<[string, string] | null>(null)
  const isFocusedRef = useRef(false)
  const [prevTitle, setPrevTitle] = useState(title)

  // Reset local edit when the title prop changes (e.g. note switch).
  // This prevents a stale handleFocus closure from locking in the old note's title
  // when focus-editor fires before React re-renders with the new tab.
  if (prevTitle !== title) {
    setPrevTitle(title)
    if (localValue !== null) setLocalValue(null)
  }

  // Clear optimistic once the prop changes (rename completed or tab switched)
  const optimisticValue = optimistic && optimistic[1] === title ? optimistic[0] : null
  const value = localValue ?? optimisticValue ?? title
  const isEditing = localValue !== null || optimisticValue !== null

  const handleFocus = useCallback(() => {
    isFocusedRef.current = true
    setLocalValue(title)
  }, [title])

  const commitTitle = useCallback(() => {
    isFocusedRef.current = false
    const trimmed = (localValue ?? '').trim()
    if (trimmed && trimmed !== title) {
      setLocalValue(null)
      setOptimistic([trimmed, title])
      onTitleChange(trimmed)
    } else {
      setLocalValue(null)
    }
  }, [localValue, title, onTitleChange])

  const revert = useCallback(() => setLocalValue(null), [])
  const setEdit = useCallback((v: string) => setLocalValue(v), [])

  return { value, isEditing, handleFocus, commitTitle, revert, setEdit }
}

/**
 * Dedicated title input field above the editor.
 * Displays the title as an editable field and shows the resulting filename below.
 */
export function TitleField({ title, filename, editable = true, notePath, vaultPath, onTitleChange }: TitleFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { value, isEditing, handleFocus, commitTitle, revert, setEdit } =
    useOptimisticTitle(title, onTitleChange)

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

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      inputRef.current?.blur()
    }
    if (e.key === 'Escape') {
      revert()
      inputRef.current?.blur()
    }
  }, [revert])

  const expectedSlug = slugify(value.trim() || title)
  const currentStem = filename.replace(/\.md$/, '')
  const showFilename = isEditing || currentStem !== expectedSlug

  // Compute vault-relative path (only for notes in subdirectories)
  const relativePath = notePath && vaultPath
    ? notePath.replace(vaultPath + '/', '')
    : null
  const showRelativePath = relativePath && relativePath.includes('/')

  return (
    <div className="title-field" data-testid="title-field">
      <input
        ref={inputRef}
        className="title-field__input"
        value={value}
        onChange={e => setEdit(e.target.value)}
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
      {showRelativePath && (
        <span className="title-field__path" data-testid="title-field-path" style={{ display: 'block', fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
          {relativePath}
        </span>
      )}
    </div>
  )
}
