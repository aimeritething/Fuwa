import type { SidebarSelection } from '../types'

const NOTE_LIST_CONTAINER_SELECTOR = '[data-testid="note-list-container"]'
const EDITOR_SURFACE_SELECTOR = '.editor__blocknote-container, .cm-editor'

function isSameFilterSelection(a: Extract<SidebarSelection, { kind: 'filter' }>, b: Extract<SidebarSelection, { kind: 'filter' }>) {
  return a.filter === b.filter
}

function isSameSectionSelection(a: Extract<SidebarSelection, { kind: 'sectionGroup' }>, b: Extract<SidebarSelection, { kind: 'sectionGroup' }>) {
  return a.type === b.type
}

function isSameFolderSelection(a: Extract<SidebarSelection, { kind: 'folder' }>, b: Extract<SidebarSelection, { kind: 'folder' }>) {
  return a.path === b.path
}

function isSameEntitySelection(a: Extract<SidebarSelection, { kind: 'entity' }>, b: Extract<SidebarSelection, { kind: 'entity' }>) {
  return a.entry.path === b.entry.path
}

function isSameViewSelection(a: Extract<SidebarSelection, { kind: 'view' }>, b: Extract<SidebarSelection, { kind: 'view' }>) {
  return a.filename === b.filename
}

export function selectionsEqual(a: SidebarSelection, b: SidebarSelection): boolean {
  if (a.kind !== b.kind) return false

  switch (a.kind) {
    case 'filter':
      return isSameFilterSelection(a, b)
    case 'sectionGroup':
      return isSameSectionSelection(a, b)
    case 'folder':
      return isSameFolderSelection(a, b)
    case 'entity':
      return isSameEntitySelection(a, b)
    case 'view':
      return isSameViewSelection(a, b)
  }
}

export function pushNeighborhoodHistory(
  history: SidebarSelection[],
  currentSelection: SidebarSelection,
  nextSelection: SidebarSelection,
): SidebarSelection[] {
  if (selectionsEqual(currentSelection, nextSelection)) return history
  return [...history, currentSelection]
}

export function popNeighborhoodHistory(history: SidebarSelection[]) {
  if (history.length === 0) return { previousSelection: null, nextHistory: history }

  const previousSelection = history[history.length - 1] ?? null
  return {
    previousSelection,
    nextHistory: history.slice(0, -1),
  }
}

export function shouldProcessNeighborhoodEscape(
  event: Pick<KeyboardEvent, 'defaultPrevented' | 'key' | 'metaKey' | 'ctrlKey' | 'altKey'>,
  selection: SidebarSelection,
  blocked: boolean,
): boolean {
  return !event.defaultPrevented
    && event.key === 'Escape'
    && !event.metaKey
    && !event.ctrlKey
    && !event.altKey
    && selection.kind === 'entity'
    && !blocked
}

export function isEditableElement(element: Element | null): element is HTMLElement {
  if (!element) return false
  if (
    element instanceof HTMLInputElement
    || element instanceof HTMLTextAreaElement
    || element instanceof HTMLSelectElement
  ) return true
  if (!(element instanceof HTMLElement)) return false
  return element.isContentEditable || !!element.closest('[contenteditable="true"]')
}

export function isEditorEscapeTarget(element: Element | null): boolean {
  return isEditableElement(element)
    && element.closest(EDITOR_SURFACE_SELECTOR) !== null
}

export function focusNoteListContainer(documentObject: Document): boolean {
  const noteListContainer = documentObject.querySelector<HTMLElement>(NOTE_LIST_CONTAINER_SELECTOR)
  if (!noteListContainer) return false
  noteListContainer.focus()
  return documentObject.activeElement === noteListContainer
}
