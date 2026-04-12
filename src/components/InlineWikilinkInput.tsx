import {
  useMemo,
  type ReactNode,
} from 'react'
import type { VaultEntry } from '../types'
import type { NoteReference } from '../utils/ai-context'
import { buildTypeEntryMap } from '../utils/typeColors'
import {
  buildInlineWikilinkSegments,
  extractInlineWikilinkReferences,
  findActiveWikilinkQuery,
  findInlineChipDeletionRange,
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

function deleteInlineChip({
  direction,
  segments,
  selectionIndex,
  value,
  onChange,
  onSelectionIndexChange,
}: {
  direction: 'backward' | 'forward'
  segments: ReturnType<typeof buildInlineWikilinkSegments>
  selectionIndex: number
  value: string
  onChange: (value: string) => void
  onSelectionIndexChange: (selectionIndex: number) => void
}) {
  const deletionRange = findInlineChipDeletionRange(segments, selectionIndex, direction)
  if (!deletionRange) return false

  onChange(value.slice(0, deletionRange.start) + value.slice(deletionRange.end))
  onSelectionIndexChange(deletionRange.start)
  return true
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
    selectionIndex,
    setSelectionIndex,
    setCombinedRef,
    syncSelectionIndex,
    commitValueFromEditor,
    focusSelectionAt,
  } = useInlineWikilinkSelection({
    value,
    onChange,
    inputRef,
  })
  const activeQuery = useMemo(
    () => findActiveWikilinkQuery(value, selectionIndex),
    [selectionIndex, value],
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
    onSelectionIndexChange: setSelectionIndex,
    focusSelectionAt,
  })
  const deleteAdjacentChip = (direction: 'backward' | 'forward') => {
    return deleteInlineChip({
      direction,
      segments,
      selectionIndex,
      value,
      onChange,
      onSelectionIndexChange: setSelectionIndex,
    })
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
      onDeleteAdjacentChip: deleteAdjacentChip,
      canSubmit: onSubmit !== undefined,
      onSubmit: submitValue,
    })
  const editor = (
    <InlineWikilinkEditorField
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      inputRef={setCombinedRef}
      dataTestId={dataTestId}
      editorClassName={editorClassName}
      onInput={commitValueFromEditor}
      onKeyDown={handleKeyDown}
      onSelectionChange={syncSelectionIndex}
      segments={segments}
      typeEntryMap={typeEntryMap}
    />
  )
  const suggestionList = suggestions.length > 0 ? (
    <InlineWikilinkSuggestionList
      suggestions={suggestions}
      selectedIndex={selectedSuggestionIndex}
      onHover={setSuggestionIndex}
      onSelect={selectSuggestion}
      typeEntryMap={typeEntryMap}
      variant={suggestionListVariant}
      emptyLabel={suggestionEmptyLabel}
    />
  ) : null
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
