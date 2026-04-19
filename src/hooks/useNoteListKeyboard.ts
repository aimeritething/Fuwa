import { useState, useCallback, useEffect, useRef } from 'react'
import type { VirtuosoHandle } from 'react-virtuoso'
import type { VaultEntry } from '../types'

interface NoteListKeyboardOptions {
  items: VaultEntry[]
  selectedNotePath: string | null
  onOpen: (entry: VaultEntry) => void
  onEnterNeighborhood?: (entry: VaultEntry) => void | Promise<void>
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

function isInteractiveElement(element: Element | null): boolean {
  if (!element) return false
  if (isEditableElement(element)) return true
  if (!(element instanceof HTMLElement)) return false
  return element instanceof HTMLButtonElement
    || element instanceof HTMLAnchorElement
    || element.getAttribute('role') === 'button'
}

function isNestedInteractiveTarget(
  target: EventTarget | null,
  currentTarget: EventTarget | null,
): boolean {
  return target instanceof Element
    && currentTarget instanceof Element
    && target !== currentTarget
    && currentTarget.contains(target)
    && isInteractiveElement(target)
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

function resolveHighlightedEntry(items: VaultEntry[], highlightedPath: string | null): VaultEntry | undefined {
  if (!highlightedPath) return undefined
  return items.find((entry) => entry.path === highlightedPath)
}

function usesCommandModifier(event: Pick<KeyboardEvent, 'metaKey' | 'ctrlKey'>): boolean {
  return event.metaKey || event.ctrlKey
}

function isNeighborhoodKey(event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey'>): boolean {
  return event.key === 'Enter' && usesCommandModifier(event) && !event.altKey
}

function useKeyboardItemRefs(items: VaultEntry[], selectedNotePath: string | null) {
  const itemsRef = useRef(items)
  const selectedNotePathRef = useRef(selectedNotePath)

  useEffect(() => {
    itemsRef.current = items
    selectedNotePathRef.current = selectedNotePath
  }, [items, selectedNotePath])

  return { itemsRef, selectedNotePathRef }
}

function useHighlightedPath() {
  const [highlightedPathState, setHighlightedPath] = useState<string | null>(null)
  const highlightedPathRef = useRef<string | null>(null)

  const syncHighlightedPath = useCallback((nextPath: string | null) => {
    highlightedPathRef.current = nextPath
    setHighlightedPath(nextPath)
  }, [])

  return { highlightedPathRef, highlightedPathState, syncHighlightedPath }
}

function useSelectionSync(
  itemsRef: React.RefObject<VaultEntry[]>,
  selectedNotePathRef: React.RefObject<string | null>,
  syncHighlightedPath: (nextPath: string | null) => void,
) {
  return useCallback(() => {
    syncHighlightedPath(resolveHighlightedPath(itemsRef.current, selectedNotePathRef.current))
  }, [itemsRef, selectedNotePathRef, syncHighlightedPath])
}

function useMoveHighlight({
  items,
  selectedNotePath,
  highlightedPathRef,
  syncHighlightedPath,
  virtuosoRef,
  onOpen,
  onPrefetch,
}: {
  items: VaultEntry[]
  selectedNotePath: string | null
  highlightedPathRef: React.RefObject<string | null>
  syncHighlightedPath: (nextPath: string | null) => void
  virtuosoRef: React.RefObject<VirtuosoHandle | null>
  onOpen: (entry: VaultEntry) => void
  onPrefetch?: (entry: VaultEntry) => void
}) {
  return useCallback((direction: 1 | -1) => {
    const currentIndex = resolveCurrentIndex(items, highlightedPathRef.current, selectedNotePath)
    const nextIndex = moveHighlightIndex(currentIndex, direction, items.length)
    const currentPath = highlightedPathRef.current ?? selectedNotePath
    const nextItem = items[nextIndex]
    if (!nextItem || nextItem.path === currentPath) return

    syncHighlightedPath(nextItem.path)
    virtuosoRef.current?.scrollIntoView({ index: nextIndex, behavior: 'auto' })
    onOpen(nextItem)
    onPrefetch?.(nextItem)
  }, [highlightedPathRef, items, onOpen, onPrefetch, selectedNotePath, syncHighlightedPath, virtuosoRef])
}

function useProcessKeyDown({
  enabled,
  items,
  highlightedPathRef,
  moveHighlight,
  onOpen,
  onEnterNeighborhood,
}: {
  enabled: boolean
  items: VaultEntry[]
  highlightedPathRef: React.RefObject<string | null>
  moveHighlight: (direction: 1 | -1) => void
  onOpen: (entry: VaultEntry) => void
  onEnterNeighborhood?: (entry: VaultEntry) => void | Promise<void>
}) {
  return useCallback((event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'preventDefault'>) => {
    if (!enabled || items.length === 0) return

    if (isNeighborhoodKey(event)) {
      const highlightedItem = resolveHighlightedEntry(items, highlightedPathRef.current)
      if (!highlightedItem) return
      event.preventDefault()
      void onEnterNeighborhood?.(highlightedItem)
      return
    }

    if (usesCommandModifier(event) || event.altKey) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveHighlight(1)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveHighlight(-1)
      return
    }

    if (event.key !== 'Enter') return

    const highlightedItem = resolveHighlightedEntry(items, highlightedPathRef.current)
    if (!highlightedItem) return
    event.preventDefault()
    onOpen(highlightedItem)
  }, [enabled, highlightedPathRef, items, moveHighlight, onEnterNeighborhood, onOpen])
}

function useFocusHandlers({
  containerRef,
  syncToCurrentSelection,
  syncHighlightedPath,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>
  syncToCurrentSelection: () => void
  syncHighlightedPath: (nextPath: string | null) => void
}) {
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
  }, [containerRef, syncToCurrentSelection])

  return { focusList, handleBlur, handleFocus }
}

function useGlobalKeyboardHandling({
  enabled,
  containerRef,
  processKeyDown,
}: {
  enabled: boolean
  containerRef: React.RefObject<HTMLDivElement | null>
  processKeyDown: (event: KeyboardEvent) => void
}) {
  useEffect(() => {
    if (!enabled) return

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      const activeElement = document.activeElement
      if (isEditableElement(activeElement)) return
      if (
        activeElement !== containerRef.current
        && containerRef.current?.contains(activeElement)
        && isInteractiveElement(activeElement)
      ) return
      processKeyDown(event)
    }

    window.addEventListener('keydown', handleWindowKeyDown)
    return () => window.removeEventListener('keydown', handleWindowKeyDown)
  }, [containerRef, enabled, processKeyDown])
}

export function useNoteListKeyboard({
  items, selectedNotePath, onOpen, onEnterNeighborhood, onPrefetch, enabled,
}: NoteListKeyboardOptions) {
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { itemsRef, selectedNotePathRef } = useKeyboardItemRefs(items, selectedNotePath)
  const { highlightedPathRef, highlightedPathState, syncHighlightedPath } = useHighlightedPath()
  const syncToCurrentSelection = useSelectionSync(itemsRef, selectedNotePathRef, syncHighlightedPath)
  const moveHighlight = useMoveHighlight({
    items,
    selectedNotePath,
    highlightedPathRef,
    syncHighlightedPath,
    virtuosoRef,
    onOpen,
    onPrefetch,
  })
  const processKeyDown = useProcessKeyDown({
    enabled,
    items,
    highlightedPathRef,
    moveHighlight,
    onOpen,
    onEnterNeighborhood,
  })
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (isNestedInteractiveTarget(event.target, event.currentTarget)) return
    processKeyDown(event)
  }, [processKeyDown])
  const { focusList, handleBlur, handleFocus } = useFocusHandlers({
    containerRef,
    syncToCurrentSelection,
    syncHighlightedPath,
  })
  useGlobalKeyboardHandling({ enabled, containerRef, processKeyDown })

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
