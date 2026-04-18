import {
  useMemo,
  type ReactNode,
} from 'react'
import type { VaultEntry } from '../types'
import type { NoteReference } from '../utils/ai-context'
import { buildTypeEntryMap } from '../utils/typeColors'
import {
  deleteInlineSelection,
  replaceInlineSelection,
} from './inlineWikilinkEdits'
import {
  buildInlineWikilinkSegments,
  extractInlineWikilinkReferences,
  findActiveWikilinkQuery,
} from './inlineWikilinkText'
import {
  InlineWikilinkEditorField,
  InlineWikilinkPaletteLayout,
  InlineWikilinkSuggestionList,
} from './InlineWikilinkParts'
import { handleInlineWikilinkKeyDown } from './inlineWikilinkKeydown'
import { useInlineWikilinkSelection } from './useInlineWikilinkSelection'
import { useInlineWikilinkSuggestionsState } from './useInlineWikilinkSuggestionsState'
import { normalizeInlineWikilinkValue } from './inlineWikilinkTokens'

interface InlineWikilinkInputProps {
  entries: VaultEntry[]
  value: string
  onChange: (value: string) => void
  onSubmit?: (text: string, references: NoteReference[]) => void
  submitOnEmpty?: boolean
  disabled?: boolean
  placeholder?: string
  inputRef?: React.RefObject<HTMLDivElement | null>
  dataTestId?: string
  editorClassName?: string
  suggestionListVariant?: 'floating' | 'palette'
  suggestionEmptyLabel?: string
  paletteHeader?: ReactNode
  paletteEmptyState?: ReactNode
  paletteFooter?: ReactNode
}

function collapseSelectionRange(nextSelectionIndex: number) {
  return {
    start: nextSelectionIndex,
    end: nextSelectionIndex,
  }
}

function submitInlineValue({
  onSubmit,
  submitOnEmpty,
  value,
  references,
}: {
  onSubmit?: (text: string, references: NoteReference[]) => void
  submitOnEmpty: boolean
  value: string
  references: NoteReference[]
}) {
  if (!onSubmit) return
  const normalizedValue = normalizeInlineWikilinkValue(value)
  if (!submitOnEmpty && !normalizedValue.trim()) return
  onSubmit(normalizedValue, references)
}

function renderInlineEditorField({
  value,
  placeholder,
  disabled,
  inputRef,
  dataTestId,
  editorClassName,
  onInput,
  onKeyDown,
  onPaste,
  onSelectionChange,
  segments,
  typeEntryMap,
}: {
  value: string
  placeholder?: string
  disabled: boolean
  inputRef: React.Ref<HTMLDivElement>
  dataTestId: string
  editorClassName?: string
  onInput: () => void
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void
  onPaste: (event: React.ClipboardEvent<HTMLDivElement>) => void
  onSelectionChange: () => void
  segments: ReturnType<typeof buildInlineWikilinkSegments>
  typeEntryMap: Record<string, VaultEntry>
}) {
  return (
    <InlineWikilinkEditorField
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      inputRef={inputRef}
      dataTestId={dataTestId}
      editorClassName={editorClassName}
      onInput={onInput}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onSelectionChange={onSelectionChange}
      segments={segments}
      typeEntryMap={typeEntryMap}
    />
  )
}

function renderInlineSuggestionList({
  suggestions,
  selectedSuggestionIndex,
  setSuggestionIndex,
  selectSuggestion,
  typeEntryMap,
  suggestionListVariant,
  suggestionEmptyLabel,
}: {
  suggestions: ReturnType<typeof useInlineWikilinkSuggestionsState>['suggestions']
  selectedSuggestionIndex: number
  setSuggestionIndex: (index: number) => void
  selectSuggestion: (index: number) => void
  typeEntryMap: Record<string, VaultEntry>
  suggestionListVariant: 'floating' | 'palette'
  suggestionEmptyLabel: string
}) {
  if (suggestions.length === 0) return null

  return (
    <InlineWikilinkSuggestionList
      suggestions={suggestions}
      selectedIndex={selectedSuggestionIndex}
      onHover={setSuggestionIndex}
      onSelect={selectSuggestion}
      typeEntryMap={typeEntryMap}
      variant={suggestionListVariant}
      emptyLabel={suggestionEmptyLabel}
    />
  )
}

export function InlineWikilinkInput({
  entries,
  value,
  onChange,
  onSubmit,
  submitOnEmpty = false,
  disabled = false,
  placeholder,
  inputRef,
  dataTestId = 'agent-input',
  editorClassName,
  suggestionListVariant = 'floating',
  suggestionEmptyLabel = 'No matching notes',
  paletteHeader,
  paletteEmptyState,
  paletteFooter,
}: InlineWikilinkInputProps) {
  const segments = useMemo(
    () => buildInlineWikilinkSegments(value, entries),
    [entries, value],
  )
  const typeEntryMap = useMemo(() => buildTypeEntryMap(entries), [entries])
  const {
    selectionRange,
    selectionIndex,
    setSelectionRange,
    setCombinedRef,
    syncSelectionRange,
    commitValueFromEditor,
    focusSelectionRange,
  } = useInlineWikilinkSelection({
    value,
    onChange,
    inputRef,
  })
  const activeQuery = useMemo(
    () => selectionRange.start === selectionRange.end
      ? findActiveWikilinkQuery(value, selectionIndex)
      : null,
    [selectionIndex, selectionRange.end, selectionRange.start, value],
  )
  const references = useMemo(() => extractInlineWikilinkReferences(value, entries), [entries, value])
  const {
    suggestions,
    selectedSuggestionIndex,
    setSuggestionIndex,
    selectSuggestion,
    cycleSuggestions,
  } = useInlineWikilinkSuggestionsState({
    activeQueryKey: activeQuery ? `${activeQuery.start}:${activeQuery.query}` : '',
    entries,
    query: activeQuery?.query ?? null,
    value,
    selectionIndex,
    onChange,
    onSelectionIndexChange: (nextSelectionIndex) => setSelectionRange(collapseSelectionRange(nextSelectionIndex)),
    focusSelectionAt: (nextSelectionIndex) => focusSelectionRange(collapseSelectionRange(nextSelectionIndex)),
  })
  const insertText = (text: string) => {
    const nextState = replaceInlineSelection(value, selectionRange, text)
    onChange(nextState.value)
    setSelectionRange(nextState.selection)
  }
  const deleteContent = (direction: 'backward' | 'forward') => {
    const nextState = deleteInlineSelection(value, selectionRange, segments, direction)
    if (!nextState) return
    onChange(nextState.value)
    setSelectionRange(nextState.selection)
  }
  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (disabled) return

    const pastedText = normalizeInlineWikilinkValue(event.clipboardData.getData('text/plain'))
    if (!pastedText) return

    event.preventDefault()
    const nextState = replaceInlineSelection(value, selectionRange, pastedText)
    onChange(nextState.value)
    setSelectionRange(nextState.selection)
  }
  const submitValue = () =>
    submitInlineValue({ onSubmit, submitOnEmpty, value, references })
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) =>
    handleInlineWikilinkKeyDown({
      event,
      disabled,
      suggestionsOpen: suggestions.length > 0,
      onCycleSuggestions: cycleSuggestions,
      onSelectSuggestion: () => selectSuggestion(selectedSuggestionIndex),
      onDeleteContent: deleteContent,
      onInsertText: insertText,
      canSubmit: onSubmit !== undefined,
      onSubmit: submitValue,
    })
  const editor = renderInlineEditorField({
    value,
    placeholder,
    disabled,
    inputRef: setCombinedRef,
    dataTestId,
    editorClassName,
    onInput: commitValueFromEditor,
    onKeyDown: handleKeyDown,
    onPaste: handlePaste,
    onSelectionChange: syncSelectionRange,
    segments,
    typeEntryMap,
  })
  const suggestionList = renderInlineSuggestionList({
    suggestions,
    selectedSuggestionIndex,
    setSuggestionIndex,
    selectSuggestion,
    typeEntryMap,
    suggestionListVariant,
    suggestionEmptyLabel,
  })
  if (suggestionListVariant === 'palette') {
    return (
      <InlineWikilinkPaletteLayout
        header={paletteHeader}
        editor={editor}
        suggestionList={suggestionList}
        emptyState={paletteEmptyState}
        footer={paletteFooter}
      />
    )
  }
  return <div className="relative">{editor}{suggestionList}</div>
}
