import { useEffect, useRef, type RefObject } from 'react'

type RectLike = Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>

const HOVER_BRIDGE_PADDING_X = 8
const HOVER_BRIDGE_PADDING_Y = 8

function isVisibleRect(rect: RectLike) {
  return rect.right > rect.left && rect.bottom > rect.top
}

function getSelectedFileBlockBridgeElement(
  container: HTMLElement,
  blockId: string,
) {
  const selectedBlock = container.querySelector<HTMLElement>(
    `.bn-block[data-id="${blockId}"]`,
  )

  if (!selectedBlock) return null

  return (
    selectedBlock.querySelector<HTMLElement>(
      '[data-file-block] .bn-visual-media-wrapper',
    ) ??
    selectedBlock.querySelector<HTMLElement>(
      '[data-file-block] .bn-file-name-with-icon',
    ) ??
    selectedBlock.querySelector<HTMLElement>('[data-file-block] .bn-add-file-button') ??
    selectedBlock.querySelector<HTMLElement>('[data-file-block]')
  )
}

export function isWithinFormattingToolbarHoverBridge(
  point: { x: number; y: number },
  fileBlockRect: RectLike,
  toolbarRect: RectLike,
) {
  if (!isVisibleRect(fileBlockRect) || !isVisibleRect(toolbarRect)) {
    return false
  }

  const left = Math.min(fileBlockRect.left, toolbarRect.left) - HOVER_BRIDGE_PADDING_X
  const right = Math.max(fileBlockRect.right, toolbarRect.right) + HOVER_BRIDGE_PADDING_X
  const top = Math.min(fileBlockRect.top, toolbarRect.top) - HOVER_BRIDGE_PADDING_Y
  const bottom = Math.max(fileBlockRect.bottom, toolbarRect.bottom) + HOVER_BRIDGE_PADDING_Y

  return (
    point.x >= left &&
    point.x <= right &&
    point.y >= top &&
    point.y <= bottom
  )
}

export function shouldSuppressFormattingToolbarHoverUpdate({
  eventTarget,
  point,
  container,
  doc,
  selectedFileBlockId,
}: {
  eventTarget: EventTarget | null
  point: { x: number; y: number }
  container: HTMLElement | null
  doc: Document
  selectedFileBlockId: string | null
}) {
  if (!container || !selectedFileBlockId) return false

  if (
    eventTarget instanceof Element &&
    eventTarget.closest('.bn-formatting-toolbar')
  ) {
    return true
  }

  const selectedFileBlock = getSelectedFileBlockBridgeElement(
    container,
    selectedFileBlockId,
  )
  const toolbar = doc.querySelector<HTMLElement>('.bn-formatting-toolbar')

  if (!selectedFileBlock || !toolbar) return false

  return isWithinFormattingToolbarHoverBridge(
    point,
    selectedFileBlock.getBoundingClientRect(),
    toolbar.getBoundingClientRect(),
  )
}

function useLastSelectedFormattingToolbarFileBlockId(
  selectedFileBlockId: string | null,
  isOpen: boolean,
) {
  const lastSelectedFileBlockIdRef = useRef<string | null>(selectedFileBlockId)

  useEffect(() => {
    if (selectedFileBlockId) {
      lastSelectedFileBlockIdRef.current = selectedFileBlockId
      return
    }

    if (!isOpen) {
      lastSelectedFileBlockIdRef.current = null
    }
  }, [isOpen, selectedFileBlockId])

  return lastSelectedFileBlockIdRef
}

function getFormattingToolbarHoverGuardEnvironment(container: HTMLElement | null) {
  const doc = container?.ownerDocument
  const view = doc?.defaultView

  if (!container || !doc || !view) return null

  return { container, doc, view }
}

function createFormattingToolbarHoverGuardHandler({
  container,
  doc,
  selectedFileBlockIdRef,
}: {
  container: HTMLElement
  doc: Document
  selectedFileBlockIdRef: RefObject<string | null>
}) {
  return (event: MouseEvent) => {
    if (
      !shouldSuppressFormattingToolbarHoverUpdate({
        eventTarget: event.target,
        point: { x: event.clientX, y: event.clientY },
        container,
        doc,
        selectedFileBlockId: selectedFileBlockIdRef.current,
      })
    ) {
      return
    }

    event.stopPropagation()
  }
}

export function useBlockNoteFormattingToolbarHoverGuard({
  container,
  selectedFileBlockId,
  isOpen,
}: {
  container: HTMLElement | null
  selectedFileBlockId: string | null
  isOpen: boolean
}) {
  const lastSelectedFileBlockIdRef = useLastSelectedFormattingToolbarFileBlockId(
    selectedFileBlockId,
    isOpen,
  )

  useEffect(() => {
    if (!isOpen) return

    const environment = getFormattingToolbarHoverGuardEnvironment(container)
    if (!environment) return

    const handleMouseMove = createFormattingToolbarHoverGuardHandler({
      container: environment.container,
      doc: environment.doc,
      selectedFileBlockIdRef: lastSelectedFileBlockIdRef,
    })

    environment.view.addEventListener('mousemove', handleMouseMove, true)
    return () => {
      environment.view.removeEventListener('mousemove', handleMouseMove, true)
    }
  }, [container, isOpen, lastSelectedFileBlockIdRef])
}
