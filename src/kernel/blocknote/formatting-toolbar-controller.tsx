import {
  PositionPopover,
  useBlockNoteEditor,
  useEditorState,
  useExtension,
  useExtensionState,
} from '@blocknote/react'
import type {
  FloatingUIOptions,
  FormattingToolbarProps,
} from '@blocknote/react'
import { blockHasType, defaultProps, type DefaultProps } from '@blocknote/core'
import type { BlockSchema, InlineContentSchema, StyleSchema } from '@blocknote/core'
import { FormattingToolbarExtension } from '@blocknote/core/extensions'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FC,
  type MutableRefObject,
  type SetStateAction,
} from 'react'
import { useBlockNoteFormattingToolbarHoverGuard } from './block-note-formatting-toolbar-hover-guard'
import { BlockTypeMenuContext, type BlockTypeMenuState } from './block-type-select'
import { CodeBlockLanguageControls } from './code-block-language-controls'
import { FormattingToolbar } from './formatting-toolbar'
import {
  getCursorBlockSafely,
  getSelectedBlocksSafely,
  isFileBlockType,
  type FormattingToolbarEditor,
} from './formatting-toolbar-selection'
import { useEditorComposing } from './use-editor-composing'

// Fuwa's controller for the floating formatting toolbar, in place of
// BlockNote's: the toolbar stays open while it is hovered or focused, or while
// its block type menu is open, and for a short grace after the selection
// collapses; it hides during IME composition; it is clamped to the viewport;
// and it mounts the code block language controls alongside.

const FORMATTER_CLOSE_GRACE_MS = 160
const FORMATTER_VIEWPORT_PADDING_PX = 8
type FloatingOptions = NonNullable<FloatingUIOptions['useFloatingOptions']>
type FloatingMiddleware = NonNullable<FloatingOptions['middleware']>[number]

// What the toolbar opens (the block type menu, the link form) is portaled to
// the body, so a pointer or focus move into it leaves the toolbar's DOM
// subtree; it counts as within the toolbar when a trigger in the toolbar
// controls it (Radix marks the pair with aria-controls and an id).
function isControlledFromToolbar(toolbar: Element, target: Node) {
  for (
    let element = target instanceof Element ? target : target.parentElement;
    element && element !== toolbar.ownerDocument.body;
    element = element.parentElement
  ) {
    if (element.id && toolbar.querySelector(`[aria-controls="${CSS.escape(element.id)}"]`)) return true
  }
  return false
}

function isFocusStillWithinToolbar(
  currentTarget: EventTarget & Element,
  nextTarget: EventTarget | null,
) {
  if (!(nextTarget instanceof Node)) return false
  return currentTarget.contains(nextTarget) || isControlledFromToolbar(currentTarget, nextTarget)
}

function clearToolbarCloseGrace(
  timeoutRef: MutableRefObject<number | null>,
  setCloseGraceActive: Dispatch<SetStateAction<boolean>>,
) {
  if (timeoutRef.current !== null) {
    window.clearTimeout(timeoutRef.current)
    timeoutRef.current = null
  }
  setCloseGraceActive(false)
}

function startToolbarCloseGrace(
  timeoutRef: MutableRefObject<number | null>,
  setCloseGraceActive: Dispatch<SetStateAction<boolean>>,
) {
  setCloseGraceActive(true)
  if (timeoutRef.current !== null) {
    window.clearTimeout(timeoutRef.current)
  }
  timeoutRef.current = window.setTimeout(() => {
    timeoutRef.current = null
    setCloseGraceActive(false)
  }, FORMATTER_CLOSE_GRACE_MS)
}

function useFormattingToolbarCloseGrace({
  show,
  toolbarHasFocus,
  toolbarHovered,
}: {
  show: boolean
  toolbarHasFocus: boolean
  toolbarHovered: boolean
}) {
  const [closeGraceActive, setCloseGraceActive] = useState(false)
  const closeGraceTimeoutRef = useRef<number | null>(null)
  const previousShowRef = useRef(show)

  const clearCloseGrace = useCallback(() => {
    clearToolbarCloseGrace(closeGraceTimeoutRef, setCloseGraceActive)
  }, [])
  const dismissImmediately = useCallback(() => {
    previousShowRef.current = false
    clearCloseGrace()
  }, [clearCloseGrace])

  useEffect(() => {
    const toolbarInteractionActive = show || toolbarHasFocus || toolbarHovered

    if (toolbarInteractionActive) {
      clearCloseGrace()
    } else if (previousShowRef.current) {
      startToolbarCloseGrace(closeGraceTimeoutRef, setCloseGraceActive)
    }

    previousShowRef.current = show
  }, [clearCloseGrace, show, toolbarHasFocus, toolbarHovered])

  useEffect(() => () => {
    if (closeGraceTimeoutRef.current !== null) {
      window.clearTimeout(closeGraceTimeoutRef.current)
    }
  }, [])

  return { closeGraceActive, clearCloseGrace, dismissImmediately }
}

type FormattingToolbarStore = {
  setState(open: boolean): void
}

function useCloseBlockTypeMenuOnEditorInteraction(
  editor: FormattingToolbarEditor,
  opened: boolean,
  closeMenu: () => void,
) {
  useEffect(() => {
    if (!opened || !editor.domElement) return
    const editorElement = editor.domElement
    editorElement.addEventListener('pointerdown', closeMenu, true)
    editorElement.addEventListener('keydown', closeMenu, true)
    editorElement.addEventListener('beforeinput', closeMenu, true)
    return () => {
      editorElement.removeEventListener('pointerdown', closeMenu, true)
      editorElement.removeEventListener('keydown', closeMenu, true)
      editorElement.removeEventListener('beforeinput', closeMenu, true)
    }
  }, [closeMenu, editor, opened])
}

function useDeduplicatedFormattingToolbarStore(
  store: FormattingToolbarStore,
  show: boolean,
) {
  const openRef = useRef(show)

  useEffect(() => {
    openRef.current = show
  }, [show])

  return useCallback((open: boolean) => {
    if (openRef.current === open) return
    openRef.current = open
    store.setState(open)
  }, [store])
}

function textAlignmentToPlacement(textAlignment: DefaultProps['textAlignment']) {
  switch (textAlignment) {
    case 'left':
      return 'top-start'
    case 'center':
      return 'top'
    case 'right':
      return 'top-end'
    default:
      return 'top-start'
  }
}

function viewportClampMiddleware(): FloatingMiddleware {
  return {
    name: 'viewportClamp',
    fn({ x, rects }: { rects: { floating: { width: number } }; x: number }) {
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth
      const minX = FORMATTER_VIEWPORT_PADDING_PX
      const maxX = Math.max(
        minX,
        viewportWidth - rects.floating.width - FORMATTER_VIEWPORT_PADDING_PX,
      )

      return {
        x: Math.min(Math.max(x, minX), maxX),
      }
    },
  }
}

function withViewportSafeMiddleware(options?: FloatingOptions): FloatingOptions {
  if (!options) {
    return {
      middleware: [viewportClampMiddleware()],
    }
  }

  return {
    ...options,
    middleware: [
      ...(options.middleware ?? []),
      viewportClampMiddleware(),
    ],
  }
}

function getFormattingToolbarBridgeBlockId(editor: FormattingToolbarEditor) {
  const selectedBlock = getSelectedBlocksSafely(editor).at(0)
  if (!selectedBlock) return null

  return isFileBlockType(selectedBlock.type) ? selectedBlock.id : null
}

function getFormattingToolbarAnchorElement(editor: FormattingToolbarEditor) {
  const anchor = editor.domElement?.firstElementChild
  return anchor instanceof Element && anchor.isConnected ? anchor : null
}

type FormattingToolbarControllerProps = {
  formattingToolbar?: FC<FormattingToolbarProps>;
  floatingUIOptions?: FloatingUIOptions;
}

function useFormattingToolbarInteractionState({
  editor,
  formattingToolbarStore,
  isComposing,
  show,
}: {
  editor: FormattingToolbarEditor
  formattingToolbarStore: FormattingToolbarStore
  isComposing: boolean
  show: boolean
}) {
  const [toolbarHasFocus, setToolbarHasFocus] = useState(false)
  const [toolbarHovered, setToolbarHovered] = useState(false)
  const [blockTypeMenuOpened, setBlockTypeMenuOpened] = useState(false)
  const blockTypeMenuState = useMemo<BlockTypeMenuState>(() => ({
    opened: blockTypeMenuOpened,
    setOpened: setBlockTypeMenuOpened,
  }), [blockTypeMenuOpened])
  const { closeGraceActive, clearCloseGrace, dismissImmediately } = useFormattingToolbarCloseGrace({
    show,
    toolbarHasFocus,
    toolbarHovered,
  })
  const setFormattingToolbarOpen = useDeduplicatedFormattingToolbarStore(
    formattingToolbarStore,
    show,
  )
  const closeBlockTypeMenuFromEditor = useCallback(() => {
    setBlockTypeMenuOpened(false)
    setToolbarHasFocus(false)
    setToolbarHovered(false)
    dismissImmediately()
    setFormattingToolbarOpen(false)
  }, [dismissImmediately, setFormattingToolbarOpen])
  useCloseBlockTypeMenuOnEditorInteraction(editor, blockTypeMenuOpened, closeBlockTypeMenuFromEditor)

  return {
    blockTypeMenuState,
    clearCloseGrace,
    isOpen: !isComposing
      && (show || toolbarHasFocus || toolbarHovered || blockTypeMenuOpened || closeGraceActive),
    setBlockTypeMenuOpened,
    setFormattingToolbarOpen,
    setToolbarHasFocus,
    setToolbarHovered,
  }
}

type FormattingToolbarSurfaceProps = {
  Component?: FC<FormattingToolbarProps>
  blockTypeMenuState: BlockTypeMenuState
  floatingUIOptions: FloatingUIOptions
  position: { from: number; to: number } | undefined
  setBlockTypeMenuOpened: Dispatch<SetStateAction<boolean>>
  setFormattingToolbarOpen: (open: boolean) => void
  setToolbarHasFocus: Dispatch<SetStateAction<boolean>>
  setToolbarHovered: Dispatch<SetStateAction<boolean>>
  shouldRender: boolean
}

// The wrapper's own blur and pointerleave miss a control that goes away while
// focused or under the pointer (the link form unmounts on Enter): the browser
// fires neither on a removed node. The document's next focusin or pointerover
// outside the toolbar settles the flags instead.
function useToolbarLeaveFallback({
  active,
  onFocusLeft,
  onPointerLeft,
  wrapperRef,
}: {
  active: boolean
  onFocusLeft: () => void
  onPointerLeft: () => void
  wrapperRef: MutableRefObject<HTMLDivElement | null>
}) {
  useEffect(() => {
    if (!active) return
    const isWithin = (target: EventTarget | null) => {
      const wrapper = wrapperRef.current
      return wrapper !== null && isFocusStillWithinToolbar(wrapper, target)
    }
    const handleFocusIn = (event: FocusEvent) => {
      if (!isWithin(event.target)) onFocusLeft()
    }
    const handlePointerOver = (event: PointerEvent) => {
      if (!isWithin(event.target)) onPointerLeft()
    }
    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('pointerover', handlePointerOver)
    return () => {
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('pointerover', handlePointerOver)
    }
  }, [active, onFocusLeft, onPointerLeft, wrapperRef])
}

function FormattingToolbarSurface(props: FormattingToolbarSurfaceProps) {
  const {
    Component,
    blockTypeMenuState,
    floatingUIOptions,
    position,
    setBlockTypeMenuOpened,
    setFormattingToolbarOpen,
    setToolbarHasFocus,
    setToolbarHovered,
    shouldRender,
  } = props
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const onFocusLeft = useCallback(() => {
    setToolbarHasFocus(false)
    setBlockTypeMenuOpened(false)
    setFormattingToolbarOpen(false)
  }, [setBlockTypeMenuOpened, setFormattingToolbarOpen, setToolbarHasFocus])
  const onPointerLeft = useCallback(() => setToolbarHovered(false), [setToolbarHovered])
  useToolbarLeaveFallback({ active: shouldRender, onFocusLeft, onPointerLeft, wrapperRef })
  return (
    <PositionPopover position={position} {...floatingUIOptions}>
      {shouldRender && (
        <div
          ref={wrapperRef}
          onPointerEnter={() => setToolbarHovered(true)}
          onPointerLeave={(event) => {
            if (!isFocusStillWithinToolbar(event.currentTarget, event.relatedTarget)) setToolbarHovered(false)
          }}
          onFocusCapture={() => setToolbarHasFocus(true)}
          onBlurCapture={(event) => {
            if (isFocusStillWithinToolbar(event.currentTarget, event.relatedTarget)) return
            setToolbarHasFocus(false)
            setBlockTypeMenuOpened(false)
            setFormattingToolbarOpen(false)
          }}
        >
          <BlockTypeMenuContext.Provider value={blockTypeMenuState}>
            {Component ? <Component /> : <FormattingToolbar />}
          </BlockTypeMenuContext.Provider>
        </div>
      )}
    </PositionPopover>
  )
}

export function FormattingToolbarController(props: FormattingToolbarControllerProps) {
  const editor = useBlockNoteEditor<BlockSchema, InlineContentSchema, StyleSchema>()
  const formattingToolbar = useExtension(FormattingToolbarExtension, {
    editor,
  })
  const show = useExtensionState(FormattingToolbarExtension, {
    editor,
  })
  const isComposing = useEditorComposing(editor)
  const {
    blockTypeMenuState,
    clearCloseGrace,
    isOpen,
    setBlockTypeMenuOpened,
    setFormattingToolbarOpen,
    setToolbarHasFocus,
    setToolbarHovered,
  } = useFormattingToolbarInteractionState({
    editor,
    formattingToolbarStore: formattingToolbar.store,
    isComposing,
    show,
  })
  const hasFloatingToolbarAnchor = getFormattingToolbarAnchorElement(editor) !== null
  const shouldRenderFloatingToolbar = isOpen && hasFloatingToolbarAnchor
  const currentBridgeBlockId = useEditorState({
    editor,
    selector: ({ editor }) => getFormattingToolbarBridgeBlockId(editor),
  })

  useBlockNoteFormattingToolbarHoverGuard({
    editor,
    container:
      editor.domElement?.closest('.editor__blocknote-container') ??
      editor.domElement ??
      null,
    selectedFileBlockId: currentBridgeBlockId,
    isOpen,
  })

  const position = useEditorState({
    editor,
    selector: ({ editor }) => (
      shouldRenderFloatingToolbar
        ? {
            from: editor.prosemirrorState.selection.from,
            to: editor.prosemirrorState.selection.to,
          }
        : undefined
    ),
  })

  const placement = useEditorState({
    editor,
    selector: ({ editor }) => {
      const block = getCursorBlockSafely(editor)
      if (!block) return 'top-start'

      if (!blockHasType(block, editor, block.type, {
        textAlignment: defaultProps.textAlignment,
      })) {
        return 'top-start'
      }

      return textAlignmentToPlacement(block.props.textAlignment)
    },
  })

  const floatingUIOptions = useMemo<FloatingUIOptions>(
    () => ({
      ...props.floatingUIOptions,
      useFloatingOptions: {
        open: shouldRenderFloatingToolbar,
        onOpenChange: (open, _event, reason) => {
          setFormattingToolbarOpen(open)
          if (!open) {
            setToolbarHasFocus(false)
            setToolbarHovered(false)
            setBlockTypeMenuOpened(false)
            clearCloseGrace()
          }
          if (reason === 'escape-key') {
            editor.focus()
          }
        },
        placement,
        ...withViewportSafeMiddleware(props.floatingUIOptions?.useFloatingOptions),
      },
      elementProps: {
        // The input to BlockNote's `--bn-ui-base-z-index` arithmetic for the wrapper, its own tier for the toolbar.
        style: {
          zIndex: 40,
        },
        ...props.floatingUIOptions?.elementProps,
      },
    }),
    [
      clearCloseGrace,
      editor,
      placement,
      props.floatingUIOptions,
      setBlockTypeMenuOpened,
      setFormattingToolbarOpen,
      setToolbarHasFocus,
      setToolbarHovered,
      shouldRenderFloatingToolbar,
    ],
  )

  return (
    <>
      <CodeBlockLanguageControls editor={editor} />
      <FormattingToolbarSurface
        Component={props.formattingToolbar}
        blockTypeMenuState={blockTypeMenuState}
        floatingUIOptions={floatingUIOptions}
        position={position}
        setBlockTypeMenuOpened={setBlockTypeMenuOpened}
        setFormattingToolbarOpen={setFormattingToolbarOpen}
        setToolbarHasFocus={setToolbarHasFocus}
        setToolbarHovered={setToolbarHovered}
        shouldRender={shouldRenderFloatingToolbar}
      />
    </>
  )
}
