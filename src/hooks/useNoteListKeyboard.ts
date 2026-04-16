import { useState, useCallback, useEffect, useRef } from 'react'
import type { VirtuosoHandle } from 'react-virtuoso'
import type { VaultEntry } from '../types'

interface NoteListKeyboardOptions {
  items: VaultEntry[]
  selectedNotePath: string | null
  onOpen: (entry: VaultEntry) => void
  onPrefetch?: (entry: VaultEntry) => void
  enabled: boolean
}

function resolveHighlightedPath(items: VaultEntry[], selectedNotePath: string | null): string | null {
  if (items.length === 0) return null
  if (!selectedNotePath) return items[0].path

  return items.some((entry) => entry.path === selectedNotePath)
    ? selectedNotePath
    : items[0].path
}

function isListActive(container: HTMLDivElement | null): boolean {
  if (!container) return false
  const activeElement = document.activeElement
  return activeElement instanceof Node && container.contains(activeElement)
}

function isEditableElement(element: Element | null): boolean {
  if (!element) return false
  if (
    element instanceof HTMLInputElement
    || element instanceof HTMLTextAreaElement
    || element instanceof HTMLSelectElement
  ) return true
  if (!(element instanceof HTMLElement)) return false
  return element.isContentEditable || !!element.closest('[contenteditable="true"]')
}

function resolveCurrentIndex(
  items: VaultEntry[],
  highlightedPath: string | null,
  selectedNotePath: string | null,
): number {
  const activePath = highlightedPath ?? selectedNotePath
  return activePath ? items.findIndex((entry) => entry.path === activePath) : -1
}

function moveHighlightIndex(
  previousIndex: number,
  direction: 1 | -1,
  itemCount: number,
): number {
  if (itemCount === 0) return -1
  if (previousIndex < 0) return direction === 1 ? 0 : itemCount - 1

  const currentIndex = Math.min(previousIndex, itemCount - 1)
  const nextIndex = currentIndex + direction
  if (nextIndex < 0 || nextIndex >= itemCount) return previousIndex
  return nextIndex
}

export function useNoteListKeyboard({
  items, selectedNotePath, onOpen, onPrefetch, enabled,
}: NoteListKeyboardOptions) {
  const [highlightedPathState, setHighlightedPath] = useState<string | null>(null)
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const highlightedPathRef = useRef<string | null>(null)
  const itemsRef = useRef(items)
  const selectedNotePathRef = useRef(selectedNotePath)

  useEffect(() => {
    itemsRef.current = items
    selectedNotePathRef.current = selectedNotePath
  }, [items, selectedNotePath])

  const syncHighlightedPath = useCallback((nextPath: string | null) => {
    highlightedPathRef.current = nextPath
    setHighlightedPath(nextPath)
  }, [])

  const syncToCurrentSelection = useCallback(() => {
    syncHighlightedPath(resolveHighlightedPath(itemsRef.current, selectedNotePathRef.current))
  }, [syncHighlightedPath])

  const moveHighlight = useCallback((direction: 1 | -1) => {
    const currentIndex = resolveCurrentIndex(items, highlightedPathRef.current, selectedNotePath)
    const nextIndex = moveHighlightIndex(currentIndex, direction, items.length)
    const currentPath = highlightedPathRef.current ?? selectedNotePath
    const nextItem = items[nextIndex]
    if (!nextItem || nextItem.path === currentPath) return

    syncHighlightedPath(nextItem.path)
    virtuosoRef.current?.scrollIntoView({ index: nextIndex, behavior: 'auto' })
    onOpen(nextItem)
    onPrefetch?.(nextItem)
  }, [items, onOpen, onPrefetch, selectedNotePath, syncHighlightedPath])

  const processKeyDown = useCallback((e: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'preventDefault'>) => {
    if (!enabled || items.length === 0) return
    if (e.metaKey || e.ctrlKey || e.altKey) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveHighlight(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveHighlight(-1)
    } else if (e.key === 'Enter' && highlightedPathRef.current) {
      e.preventDefault()
      const highlightedItem = items.find((entry) => entry.path === highlightedPathRef.current)
      if (highlightedItem) onOpen(highlightedItem)
    }
  }, [enabled, items, moveHighlight, onOpen])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    processKeyDown(e)
  }, [processKeyDown])

  const handleFocus = useCallback(() => {
    syncToCurrentSelection()
  }, [syncToCurrentSelection])

  const handleBlur = useCallback(() => {
    syncHighlightedPath(null)
  }, [syncHighlightedPath])

  const focusList = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    container.focus()
    requestAnimationFrame(() => {
      if (isListActive(containerRef.current)) syncToCurrentSelection()
    })
  }, [syncToCurrentSelection])

  useEffect(() => {
    if (!enabled) return

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (isEditableElement(document.activeElement)) return
      processKeyDown(event)
    }

    window.addEventListener('keydown', handleWindowKeyDown)
    return () => window.removeEventListener('keydown', handleWindowKeyDown)
  }, [enabled, processKeyDown])

  const highlightedPath = items.some((entry) => entry.path === highlightedPathState)
    ? highlightedPathState
    : null

  return {
    containerRef,
    focusList,
    highlightedPath,
    handleBlur,
    handleKeyDown,
    handleFocus,
    virtuosoRef,
  }
}
