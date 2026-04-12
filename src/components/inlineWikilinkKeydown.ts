import type React from 'react'

interface HandleSuggestionKeysArgs {
  event: React.KeyboardEvent<HTMLDivElement>
  suggestionsOpen: boolean
  onCycleSuggestions: (direction: 1 | -1) => void
  onSelectSuggestion: () => void
}

function handleSuggestionKeys({
  event,
  suggestionsOpen,
  onCycleSuggestions,
  onSelectSuggestion,
}: HandleSuggestionKeysArgs): boolean {
  if (!suggestionsOpen) return false

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    onCycleSuggestions(1)
    return true
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    onCycleSuggestions(-1)
    return true
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    onSelectSuggestion()
    return true
  }

  return false
}

interface HandleDeleteKeysArgs {
  event: React.KeyboardEvent<HTMLDivElement>
  onDeleteAdjacentChip: (direction: 'backward' | 'forward') => boolean
}

function handleDeleteKeys({
  event,
  onDeleteAdjacentChip,
}: HandleDeleteKeysArgs): boolean {
  if (event.key === 'Backspace' && onDeleteAdjacentChip('backward')) {
    event.preventDefault()
    return true
  }

  if (event.key === 'Delete' && onDeleteAdjacentChip('forward')) {
    event.preventDefault()
    return true
  }

  return false
}

interface HandleSubmitKeyArgs {
  event: React.KeyboardEvent<HTMLDivElement>
  canSubmit: boolean
  onSubmit: () => void
}

function handleSubmitKey({
  event,
  canSubmit,
  onSubmit,
}: HandleSubmitKeyArgs): boolean {
  if (!canSubmit) return false
  if (event.key !== 'Enter' || event.shiftKey) return false

  event.preventDefault()
  onSubmit()
  return true
}

interface HandleInlineWikilinkKeyDownArgs {
  event: React.KeyboardEvent<HTMLDivElement>
  disabled: boolean
  suggestionsOpen: boolean
  onCycleSuggestions: (direction: 1 | -1) => void
  onSelectSuggestion: () => void
  onDeleteAdjacentChip: (direction: 'backward' | 'forward') => boolean
  canSubmit: boolean
  onSubmit: () => void
}

export function handleInlineWikilinkKeyDown({
  event,
  disabled,
  suggestionsOpen,
  onCycleSuggestions,
  onSelectSuggestion,
  onDeleteAdjacentChip,
  canSubmit,
  onSubmit,
}: HandleInlineWikilinkKeyDownArgs) {
  if (disabled) return

  if (handleSuggestionKeys({
    event,
    suggestionsOpen,
    onCycleSuggestions,
    onSelectSuggestion,
  })) {
    return
  }

  if (handleDeleteKeys({ event, onDeleteAdjacentChip })) {
    return
  }

  handleSubmitKey({ event, canSubmit, onSubmit })
}
