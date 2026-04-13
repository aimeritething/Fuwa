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
  onDeleteContent: (direction: 'backward' | 'forward') => void
}

function handleDeleteKeys({
  event,
  onDeleteContent,
}: HandleDeleteKeysArgs): boolean {
  if (event.key === 'Backspace') {
    event.preventDefault()
    onDeleteContent('backward')
    return true
  }

  if (event.key === 'Delete') {
    event.preventDefault()
    onDeleteContent('forward')
    return true
  }

  return false
}

interface HandleInsertTextArgs {
  event: React.KeyboardEvent<HTMLDivElement>
  onInsertText: (text: string) => void
}

function handleInsertText({
  event,
  onInsertText,
}: HandleInsertTextArgs): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) return false
  if (event.isComposing) return false
  if (event.key.length !== 1) return false

  event.preventDefault()
  onInsertText(event.key)
  return true
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
  onDeleteContent: (direction: 'backward' | 'forward') => void
  onInsertText: (text: string) => void
  canSubmit: boolean
  onSubmit: () => void
}

export function handleInlineWikilinkKeyDown({
  event,
  disabled,
  suggestionsOpen,
  onCycleSuggestions,
  onSelectSuggestion,
  onDeleteContent,
  onInsertText,
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

  if (handleDeleteKeys({ event, onDeleteContent })) {
    return
  }

  if (handleInsertText({ event, onInsertText })) {
    return
  }

  handleSubmitKey({ event, canSubmit, onSubmit })
}
