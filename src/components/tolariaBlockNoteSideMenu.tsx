import {
  CaretDown,
  CaretRight,
  DotsSixVertical as GripVertical,
  Plus,
} from '@phosphor-icons/react'
import { SideMenuExtension, SuggestionMenu } from '@blocknote/core/extensions'
import type {
  BlockSchema,
  InlineContentSchema,
  StyleSchema,
} from '@blocknote/core'
import {
  DragHandleMenu,
  SideMenu,
  useBlockNoteEditor,
  useComponentsContext,
  useDictionary,
  useExtension,
  useExtensionState,
  type SideMenuProps,
} from '@blocknote/react'
import {
  useCallback,
  useLayoutEffect,
  useRef,
  type ComponentType,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { isStaleBlockReferenceError } from './richEditorTransformErrorRecoveryExtension'
import {
  blockElementById,
  blockElementFromPoint,
  blockIdFromElement,
  dropPlacementForPoint,
  editorBlockElement,
  type DropPlacement,
  type TolariaBlockNoteEditor,
} from './tolariaBlockNoteDom'
import {
  blockHeadingLevel,
  isCollapsibleSectionBlockForEditor,
  toggleCollapsedHeading,
  useCollapsedHeadingIds,
  useCollapsedHeadingRendering,
  type CollapsibleBlock,
} from './tolariaCollapsedSections'

type TolariaBlock = NonNullable<ReturnType<TolariaBlockNoteEditor['getBlock']>>
type SideMenuBlock = {
  children?: CollapsibleBlock[]
  content?: unknown
  id: string
  props?: Record<string, unknown>
  type: string
}
type TableHeaderContent = Record<string, unknown> & {
  headerCols?: unknown
  headerRows?: unknown
}
type PointerReorderState = {
  affordances?: ReorderAffordances
  clearListeners: () => void
  draggedBlockId: string
  editorElement: HTMLElement
  hasMoved: boolean
  lastDropTarget?: DropTarget | null
  ownerDocument: Document
  pointerId: number
  startX: number
  startY: number
}
type ReorderAffordances = {
  draggedElement: HTMLElement
  dropIndicator: HTMLElement
  pointerOffsetX: number
  pointerOffsetY: number
  preview: HTMLElement
  previousDraggedOpacity: string
}
type DropTarget = {
  blockId: string
  element: HTMLElement
  placement: DropPlacement
}
type SideMenuAlignmentState = {
  attemptsRemaining: number
  frame: number | null
  hasObservedTargets: boolean
}
type SideMenuAlignmentContext = {
  blockId: string
  editorElement: HTMLElement
  observeTargets: () => void
  ownerWindow: Window
  retry: () => void
  state: SideMenuAlignmentState
}

const POINTER_REORDER_THRESHOLD_PX = 4
const SIDE_MENU_ALIGNMENT_ATTEMPTS = 8

function liveSideMenuBlock(editor: TolariaBlockNoteEditor, block: SideMenuBlock | undefined) {
  if (!block) return undefined
  try {
    return editor.getBlock(block.id)
  } catch (error) {
    if (isStaleBlockReferenceError(error)) {
      console.warn('[editor] Ignored stale block side-menu lookup:', error)
      return undefined
    }
    throw error
  }
}

function runSideMenuAction(action: () => void) {
  try {
    action()
  } catch (error) {
    if (isStaleBlockReferenceError(error)) {
      console.warn('[editor] Ignored stale block side-menu action:', error)
      return
    }
    throw error
  }
}

function isInlineBlockEmpty(block: { content?: unknown }) {
  return Array.isArray(block.content) && block.content.length === 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function tableHeaderContent(block: unknown): TableHeaderContent | undefined {
  if (!isRecord(block) || block.type !== 'table' || !isRecord(block.content)) return undefined
  return block.content
}

function hasChildBlock(block: TolariaBlock, blockId: string): boolean {
  for (const child of block.children) {
    if (child.id === blockId || hasChildBlock(child, blockId)) return true
  }

  return false
}

function sideMenuElementForEditor(editorElement: HTMLElement): HTMLElement | null {
  const container = editorElement.closest('.editor__blocknote-container') ?? editorElement
  const sideMenu = container.querySelector('.bn-side-menu')
  return sideMenu instanceof HTMLElement ? sideMenu : null
}

function blockTextAnchorRect(blockElement: HTMLElement): DOMRect | null {
  const content = blockElement.querySelector('.bn-block-content')
  const inlineContent = content?.querySelector('.bn-inline-content') ?? content
  if (!(inlineContent instanceof HTMLElement)) return null

  const ownerDocument = inlineContent.ownerDocument
  const range = ownerDocument.createRange()
  range.selectNodeContents(inlineContent)
  const firstLineRect = Array.from(range.getClientRects())
    .find((rect) => rect.width > 0 && rect.height > 0)
  const textRect = firstLineRect ?? range.getBoundingClientRect()
  range.detach()

  if (textRect.height > 0) return textRect

  const fallbackRect = inlineContent.getBoundingClientRect()
  return fallbackRect.height > 0 ? fallbackRect : null
}

function alignSideMenuWithBlockText(editorElement: HTMLElement, blockId: string): boolean {
  const blockElement = blockElementById(editorElement, blockId)
  const sideMenu = sideMenuElementForEditor(editorElement)
  if (!blockElement || !sideMenu) return false

  const anchorRect = blockTextAnchorRect(blockElement)
  if (!anchorRect) return false

  sideMenu.style.removeProperty('translate')
  const sideMenuRect = sideMenu.getBoundingClientRect()
  if (sideMenuRect.height <= 0) return false

  const anchorCenter = anchorRect.top + anchorRect.height / 2
  const sideMenuCenter = sideMenuRect.top + sideMenuRect.height / 2
  sideMenu.style.setProperty('translate', `0 ${anchorCenter - sideMenuCenter}px`)
  return true
}

function createSideMenuAlignmentState(): SideMenuAlignmentState {
  return {
    attemptsRemaining: SIDE_MENU_ALIGNMENT_ATTEMPTS,
    frame: null,
    hasObservedTargets: false,
  }
}

function createSideMenuResizeObserver(onResize: () => void): ResizeObserver | null {
  return typeof ResizeObserver === 'undefined'
    ? null
    : new ResizeObserver(onResize)
}

function observeSideMenuAlignmentTargets({
  blockId,
  editorElement,
  resizeObserver,
  state,
}: {
  blockId: string
  editorElement: HTMLElement
  resizeObserver: ResizeObserver | null
  state: SideMenuAlignmentState
}) {
  if (state.hasObservedTargets) return

  const blockElement = blockElementById(editorElement, blockId)
  const sideMenu = sideMenuElementForEditor(editorElement)
  if (!resizeObserver || !blockElement || !sideMenu) return

  resizeObserver.observe(blockElement)
  resizeObserver.observe(sideMenu)
  state.hasObservedTargets = true
}

function scheduleSideMenuTextAlignment(context: SideMenuAlignmentContext) {
  const { blockId, editorElement, observeTargets, ownerWindow, retry, state } = context
  if (state.frame !== null) return

  state.frame = ownerWindow.requestAnimationFrame(() => {
    state.frame = null
    const aligned = alignSideMenuWithBlockText(editorElement, blockId)
    observeTargets()
    if (!aligned && state.attemptsRemaining > 0) {
      state.attemptsRemaining -= 1
      retry()
    }
  })
}

function createSideMenuAlignmentCleanup({
  editorElement,
  ownerWindow,
  resizeObserver,
  scheduleAlignment,
  state,
}: {
  editorElement: HTMLElement
  ownerWindow: Window
  resizeObserver: ResizeObserver | null
  scheduleAlignment: () => void
  state: SideMenuAlignmentState
}) {
  return () => {
    if (state.frame !== null) ownerWindow.cancelAnimationFrame(state.frame)
    resizeObserver?.disconnect()
    ownerWindow.removeEventListener('resize', scheduleAlignment)
    sideMenuElementForEditor(editorElement)?.style.removeProperty('translate')
  }
}

function createSideMenuAlignmentController(editor: TolariaBlockNoteEditor, blockId: string) {
  const editorElement = editorBlockElement(editor)
  const ownerWindow = editorElement?.ownerDocument.defaultView
  if (!editorElement || !ownerWindow) return undefined

  const state = createSideMenuAlignmentState()
  let resizeObserver: ResizeObserver | null = null
  const observeTargets = () => observeSideMenuAlignmentTargets({
    blockId,
    editorElement,
    resizeObserver,
    state,
  })
  const scheduleAlignment = () => scheduleSideMenuTextAlignment({
    blockId,
    editorElement,
    observeTargets,
    ownerWindow,
    retry: scheduleAlignment,
    state,
  })

  resizeObserver = createSideMenuResizeObserver(scheduleAlignment)
  scheduleAlignment()
  observeTargets()
  ownerWindow.addEventListener('resize', scheduleAlignment)

  return createSideMenuAlignmentCleanup({
    editorElement,
    ownerWindow,
    resizeObserver,
    scheduleAlignment,
    state,
  })
}

function useSideMenuTextAlignment(editor: TolariaBlockNoteEditor, block: SideMenuBlock | undefined) {
  const blockId = block?.id

  useLayoutEffect(() => {
    if (!blockId) return

    return createSideMenuAlignmentController(editor, blockId)
  }, [blockId, editor])
}

function styleDragPreview(preview: HTMLElement, rect: DOMRect) {
  preview.setAttribute('data-testid', 'editor-block-drag-preview')
  preview.setAttribute('aria-hidden', 'true')
  preview.className = 'editor__blocknote-container'
  preview.style.position = 'fixed'
  preview.style.width = `${rect.width}px`
  preview.style.maxHeight = `${Math.max(rect.height, 1)}px`
  preview.style.overflow = 'hidden'
  preview.style.pointerEvents = 'none'
  preview.style.opacity = '0.72'
  preview.style.zIndex = '14000'
  preview.style.boxSizing = 'border-box'
  preview.style.borderRadius = '6px'
  preview.style.background = 'var(--bg-primary, white)'
  preview.style.boxShadow = '0 10px 26px rgba(15, 23, 42, 0.18)'
}

function createDragPreview(draggedElement: HTMLElement, ownerDocument: Document): HTMLElement {
  const preview = ownerDocument.createElement('div')
  const clone = draggedElement.cloneNode(true)
  const rect = draggedElement.getBoundingClientRect()

  if (clone instanceof HTMLElement) {
    clone.style.margin = '0'
    clone.style.width = '100%'
    clone.style.pointerEvents = 'none'
    preview.appendChild(clone)
  }
  styleDragPreview(preview, rect)
  ownerDocument.body.appendChild(preview)

  return preview
}

function createDropIndicator(ownerDocument: Document): HTMLElement {
  const indicator = ownerDocument.createElement('div')
  indicator.setAttribute('data-testid', 'editor-block-drop-indicator')
  indicator.style.position = 'fixed'
  indicator.style.height = '2px'
  indicator.style.pointerEvents = 'none'
  indicator.style.background = 'var(--border-focus, #155dff)'
  indicator.style.borderRadius = '999px'
  indicator.style.boxShadow = '0 0 0 1px rgba(21, 93, 255, 0.12), 0 0 10px rgba(21, 93, 255, 0.28)'
  indicator.style.zIndex = '14001'
  indicator.style.display = 'none'
  ownerDocument.body.appendChild(indicator)

  return indicator
}

function createReorderAffordances(state: PointerReorderState): ReorderAffordances | undefined {
  const draggedElement = blockElementById(state.editorElement, state.draggedBlockId)
  if (!draggedElement) return undefined

  const rect = draggedElement.getBoundingClientRect()
  const previousDraggedOpacity = draggedElement.style.opacity
  const preview = createDragPreview(draggedElement, state.ownerDocument)
  draggedElement.style.opacity = '0.35'

  return {
    draggedElement,
    dropIndicator: createDropIndicator(state.ownerDocument),
    pointerOffsetX: state.startX - rect.left,
    pointerOffsetY: state.startY - rect.top,
    preview,
    previousDraggedOpacity,
  }
}

function cleanupReorderAffordances(affordances: ReorderAffordances | undefined) {
  if (!affordances) return

  affordances.draggedElement.style.opacity = affordances.previousDraggedOpacity
  affordances.preview.remove()
  affordances.dropIndicator.remove()
}

function updateDragPreview(affordances: ReorderAffordances, x: number, y: number) {
  affordances.preview.style.left = `${x - affordances.pointerOffsetX}px`
  affordances.preview.style.top = `${y - affordances.pointerOffsetY}px`
}

function hideDropIndicator(affordances: ReorderAffordances | undefined) {
  if (affordances) affordances.dropIndicator.style.display = 'none'
}

function updateDropIndicator(affordances: ReorderAffordances | undefined, target: DropTarget | null) {
  if (!affordances || !target) {
    hideDropIndicator(affordances)
    return
  }

  const rect = target.element.getBoundingClientRect()
  affordances.dropIndicator.style.display = 'block'
  affordances.dropIndicator.style.left = `${rect.left}px`
  affordances.dropIndicator.style.top = `${target.placement === 'before' ? rect.top - 1 : rect.bottom - 1}px`
  affordances.dropIndicator.style.width = `${rect.width}px`
}

function validDropTarget({
  editor,
  state,
  x,
  y,
}: {
  editor: TolariaBlockNoteEditor
  state: PointerReorderState
  x: number
  y: number
}): DropTarget | null {
  const targetElement = blockElementFromPoint({
    editorElement: state.editorElement,
    ownerDocument: state.ownerDocument,
    x,
    y,
  })
  if (!targetElement) return null

  const blockId = blockIdFromElement(targetElement)
  if (!blockId || blockId === state.draggedBlockId) return null

  const draggedBlock = liveSideMenuBlock(editor, { id: state.draggedBlockId, type: '' })
  const targetBlock = liveSideMenuBlock(editor, { id: blockId, type: '' })
  if (!draggedBlock || !targetBlock || hasChildBlock(draggedBlock, blockId)) return null

  return {
    blockId,
    element: targetElement,
    placement: dropPlacementForPoint(targetElement, y),
  }
}

function moveBlockByPointerDrop({
  editor,
  draggedBlockId,
  targetBlockId,
  placement,
}: {
  editor: TolariaBlockNoteEditor
  draggedBlockId: string
  targetBlockId: string
  placement: DropPlacement
}): boolean {
  if (draggedBlockId === targetBlockId) return false

  const draggedBlock = liveSideMenuBlock(editor, { id: draggedBlockId, type: '' })
  const targetBlock = liveSideMenuBlock(editor, { id: targetBlockId, type: '' })
  if (!draggedBlock || !targetBlock || hasChildBlock(draggedBlock, targetBlockId)) return false

  let moved = false
  runSideMenuAction(() => {
    editor.focus()
    editor.transact(() => {
      const currentDraggedBlock = liveSideMenuBlock(editor, { id: draggedBlockId, type: '' })
      const currentTargetBlock = liveSideMenuBlock(editor, { id: targetBlockId, type: '' })
      if (!currentDraggedBlock || !currentTargetBlock) return
      if (hasChildBlock(currentDraggedBlock, targetBlockId)) return

      editor.removeBlocks([currentDraggedBlock.id])
      editor.insertBlocks([currentDraggedBlock], currentTargetBlock.id, placement)
      moved = true
    })
  })

  return moved
}

function useSideMenuBlock() {
  const editor = useBlockNoteEditor<BlockSchema, InlineContentSchema, StyleSchema>()
  const block = useExtensionState(SideMenuExtension, {
    editor,
    selector: (state): SideMenuBlock | undefined => state?.block
      ? {
          children: state.block.children as CollapsibleBlock[] | undefined,
          content: state.block.content,
          id: state.block.id,
          props: state.block.props as Record<string, unknown> | undefined,
          type: state.block.type,
        }
      : undefined,
  })

  return { block, editor }
}

function stopSideMenuClick(event: ReactMouseEvent<Element>) {
  event.preventDefault()
  event.stopPropagation()
}

function editorElementFromSideMenuControl(control: Element): HTMLElement | undefined {
  const container = control.closest('.editor__blocknote-container')
  const editorElement = container?.querySelector('.bn-editor')
  if (editorElement instanceof HTMLElement) return editorElement

  const documentEditors = Array.from(control.ownerDocument.querySelectorAll('.bn-editor'))
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
  return documentEditors.find((element) => {
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }) ?? documentEditors.at(-1)
}

function TolariaAddBlockButton() {
  const Components = useComponentsContext()!
  const dict = useDictionary()
  const suggestionMenu = useExtension(SuggestionMenu)
  const { block, editor } = useSideMenuBlock()

  const addBlock = useCallback(() => {
    runSideMenuAction(() => {
      const liveBlock = liveSideMenuBlock(editor, block)
      if (!liveBlock) return

      if (isInlineBlockEmpty(liveBlock)) {
        editor.setTextCursorPosition(liveBlock.id)
        suggestionMenu.openSuggestionMenu('/')
        return
      }

      const insertedBlock = editor.insertBlocks([{ type: 'paragraph' }], liveBlock.id, 'after')[0]
      if (!insertedBlock) return
      editor.setTextCursorPosition(insertedBlock.id)
      suggestionMenu.openSuggestionMenu('/')
    })
  }, [block, editor, suggestionMenu])
  const onButtonClick = useCallback((event: ReactMouseEvent<Element>) => {
    stopSideMenuClick(event)
    addBlock()
  }, [addBlock])

  if (!block) return null

  return (
    <Components.SideMenu.Button
      className="bn-button"
      label={dict.side_menu.add_block_label}
      onClick={onButtonClick}
      icon={<Plus size={20} onClick={onButtonClick} data-test="dragHandleAdd" />}
    />
  )
}

function headingCollapseButtonLabel(isHeading: boolean, isCollapsed: boolean) {
  if (isHeading) return sectionCollapseButtonLabel(isCollapsed)
  return itemCollapseButtonLabel(isCollapsed)
}

function sectionCollapseButtonLabel(isCollapsed: boolean) {
  return isCollapsed ? 'Expand section' : 'Collapse section'
}

function itemCollapseButtonLabel(isCollapsed: boolean) {
  return isCollapsed ? 'Expand item' : 'Collapse item'
}

function TolariaHeadingCollapseButton() {
  const Components = useComponentsContext()!
  const { block, editor } = useSideMenuBlock()
  const collapsedHeadingIds = useCollapsedHeadingIds(editor)
  const isCollapsed = Boolean(block?.id && collapsedHeadingIds.has(block.id))
  const isHeading = blockHeadingLevel(block) !== null
  const isCollapsible = isCollapsibleSectionBlockForEditor(editor, block)
  const Icon = isCollapsed ? CaretRight : CaretDown
  const label = headingCollapseButtonLabel(isHeading, isCollapsed)

  const toggleHeading = useCallback((editorElement?: HTMLElement) => {
    runSideMenuAction(() => {
      const liveBlock = liveSideMenuBlock(editor, block)
      if (!liveBlock) return
      if (!isCollapsibleSectionBlockForEditor(editor, liveBlock as CollapsibleBlock | undefined)) return
      toggleCollapsedHeading(editor, liveBlock.id, editorElement)
    })
  }, [block, editor])
  const onButtonClick = useCallback((event: ReactMouseEvent<Element>) => {
    stopSideMenuClick(event)
    toggleHeading(editorElementFromSideMenuControl(event.currentTarget))
  }, [toggleHeading])

  if (!isCollapsible) return null

  return (
    <Components.SideMenu.Button
      className="bn-button"
      label={label}
      onClick={onButtonClick}
      icon={<Icon size={20} onClick={onButtonClick} data-test="headingCollapseToggle" />}
    />
  )
}

function TolariaSectionControlButton() {
  const { block, editor } = useSideMenuBlock()
  if (isCollapsibleSectionBlockForEditor(editor, block)) return <TolariaHeadingCollapseButton />

  return <TolariaAddBlockButton />
}

function TolariaDragHandleButton({
  children,
  dragHandleMenu,
}: SideMenuProps & { children?: ReactNode }) {
  const Components = useComponentsContext()!
  const dict = useDictionary()
  const sideMenu = useExtension(SideMenuExtension)
  const { block, editor } = useSideMenuBlock()
  const MenuComponent: ComponentType<{ children?: ReactNode }> = dragHandleMenu ?? DragHandleMenu
  const reorderStateRef = useRef<PointerReorderState | null>(null)
  const suppressNextClickRef = useRef(false)

  const clearReorderState = useCallback(() => {
    const state = reorderStateRef.current
    if (state) {
      state.clearListeners()
      cleanupReorderAffordances(state.affordances)
    }
    reorderStateRef.current = null
  }, [])

  const finishPointerReorder = useCallback((event: PointerEvent) => {
    const state = reorderStateRef.current
    if (!state || event.pointerId !== state.pointerId) return

    clearReorderState()
    if (!state.hasMoved) return

    event.preventDefault()
    suppressNextClickRef.current = true
    const dropTarget = state.lastDropTarget ?? validDropTarget({
      editor,
      state,
      x: event.clientX,
      y: event.clientY,
    })
    if (!dropTarget) return

    const moved = moveBlockByPointerDrop({
      editor,
      draggedBlockId: state.draggedBlockId,
      targetBlockId: dropTarget.blockId,
      placement: dropTarget.placement,
    })

    if (!moved) suppressNextClickRef.current = false
  }, [clearReorderState, editor])

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if ((typeof event.button === 'number' && event.button !== 0) || event.isPrimary === false) return

    runSideMenuAction(() => {
      const liveBlock = liveSideMenuBlock(editor, block)
      const editorElement = editorBlockElement(editor)
      if (!liveBlock || !editorElement) {
        event.preventDefault()
        return
      }

      clearReorderState()
      const ownerDocument = event.currentTarget.ownerDocument
      const pointerId = event.pointerId
      const handlePointerMove = (nativeEvent: PointerEvent) => {
        const state = reorderStateRef.current
        if (!state || nativeEvent.pointerId !== state.pointerId) return

        const distance = Math.hypot(
          nativeEvent.clientX - state.startX,
          nativeEvent.clientY - state.startY,
        )
        if (!state.hasMoved && distance < POINTER_REORDER_THRESHOLD_PX) return

        state.hasMoved = true
        suppressNextClickRef.current = true
        state.affordances ??= createReorderAffordances(state)
        if (!state.affordances) return

        updateDragPreview(state.affordances, nativeEvent.clientX, nativeEvent.clientY)
        state.lastDropTarget = validDropTarget({
          editor,
          state,
          x: nativeEvent.clientX,
          y: nativeEvent.clientY,
        })
        updateDropIndicator(state.affordances, state.lastDropTarget ?? null)
        nativeEvent.preventDefault()
      }
      const handlePointerUp = (nativeEvent: PointerEvent) => finishPointerReorder(nativeEvent)
      const handlePointerCancel = (nativeEvent: PointerEvent) => {
        if (nativeEvent.pointerId !== pointerId) return
        clearReorderState()
      }

      ownerDocument.addEventListener('pointermove', handlePointerMove, true)
      ownerDocument.addEventListener('pointerup', handlePointerUp, true)
      ownerDocument.addEventListener('pointercancel', handlePointerCancel, true)

      reorderStateRef.current = {
        clearListeners: () => {
          ownerDocument.removeEventListener('pointermove', handlePointerMove, true)
          ownerDocument.removeEventListener('pointerup', handlePointerUp, true)
          ownerDocument.removeEventListener('pointercancel', handlePointerCancel, true)
        },
        draggedBlockId: liveBlock.id,
        editorElement,
        hasMoved: false,
        ownerDocument,
        pointerId,
        startX: event.clientX,
        startY: event.clientY,
      }
      try {
        event.currentTarget.setPointerCapture?.(pointerId)
      } catch {
        // Document-level pointer listeners still complete the reorder gesture.
      }
    })
  }, [block, clearReorderState, editor, finishPointerReorder])

  const onClickCapture = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (!suppressNextClickRef.current) return

    suppressNextClickRef.current = false
    event.preventDefault()
    event.stopPropagation()
  }, [])

  if (!block) return null

  return (
    <Components.Generic.Menu.Root
      onOpenChange={(open: boolean) => {
        if (open) sideMenu.freezeMenu()
        else sideMenu.unfreezeMenu()
      }}
      position="left"
    >
      <Components.Generic.Menu.Trigger>
        <span
          className="tolaria-block-drag-handle"
          onPointerDown={onPointerDown}
          onClickCapture={onClickCapture}
        >
          <Components.SideMenu.Button
            label={dict.side_menu.drag_handle_label}
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            onDragEnd={sideMenu.blockDragEnd}
            className="bn-button"
            icon={<GripVertical size={20} data-test="dragHandle" />}
          />
        </span>
      </Components.Generic.Menu.Trigger>
      <MenuComponent>{children}</MenuComponent>
    </Components.Generic.Menu.Root>
  )
}

function TolariaRemoveBlockItem({ children }: { children: ReactNode }) {
  const Components = useComponentsContext()!
  const { block, editor } = useSideMenuBlock()

  if (!block) return null

  return (
    <Components.Generic.Menu.Item
      className="bn-menu-item"
      onClick={() => {
        runSideMenuAction(() => {
          const liveBlock = liveSideMenuBlock(editor, block)
          if (!liveBlock) return
          editor.removeBlocks([liveBlock.id])
        })
      }}
    >
      {children}
    </Components.Generic.Menu.Item>
  )
}

function TolariaTableHeaderItem({
  children,
  header,
}: {
  children: ReactNode
  header: 'column' | 'row'
}) {
  const Components = useComponentsContext()!
  const { block, editor } = useSideMenuBlock()
  const liveBlock = liveSideMenuBlock(editor, block)
  const tableContent = tableHeaderContent(liveBlock)

  if (!tableContent || !editor.settings.tables.headers) return null

  const checked = header === 'row'
    ? Boolean(tableContent.headerRows)
    : Boolean(tableContent.headerCols)

  return (
    <Components.Generic.Menu.Item
      className="bn-menu-item"
      checked={checked}
      onClick={() => {
        runSideMenuAction(() => {
          const currentBlock = liveSideMenuBlock(editor, block)
          const currentContent = tableHeaderContent(currentBlock)
          if (!currentBlock || !currentContent) return

          editor.updateBlock(currentBlock.id, {
            content: {
              ...currentContent,
              [header === 'row' ? 'headerRows' : 'headerCols']: checked ? undefined : 1,
            } as never,
          })
        })
      }}
    >
      {children}
    </Components.Generic.Menu.Item>
  )
}

function TolariaDragHandleMenu() {
  const dict = useDictionary()

  return (
    <DragHandleMenu>
      <TolariaRemoveBlockItem>{dict.drag_handle.delete_menuitem}</TolariaRemoveBlockItem>
      <TolariaTableHeaderItem header="row">{dict.drag_handle.header_row_menuitem}</TolariaTableHeaderItem>
      <TolariaTableHeaderItem header="column">{dict.drag_handle.header_column_menuitem}</TolariaTableHeaderItem>
    </DragHandleMenu>
  )
}

export function TolariaSideMenu(props: SideMenuProps) {
  const { block, editor } = useSideMenuBlock()
  useSideMenuTextAlignment(editor, block)

  return (
    <SideMenu {...props}>
      <TolariaDragHandleButton dragHandleMenu={TolariaDragHandleMenu} />
      <TolariaSectionControlButton />
    </SideMenu>
  )
}

export function TolariaCollapsedHeadingsController() {
  const editor = useBlockNoteEditor<BlockSchema, InlineContentSchema, StyleSchema>()
  useCollapsedHeadingRendering(editor)

  return null
}
