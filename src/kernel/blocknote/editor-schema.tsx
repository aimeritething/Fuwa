/* eslint-disable react-refresh/only-export-components -- module-level schema, not a component file */
import {
  audioParse,
  createCodeBlockSpec,
  BlockNoteSchema,
  createAudioBlockConfig,
  createStyleSpec,
  createVideoBlockConfig,
  defaultInlineContentSpecs,
  videoParse,
} from '@blocknote/core'
import {
  AudioBlock as BlockNoteAudioBlock,
  AudioToExternalHTML,
  createReactBlockSpec,
  createReactInlineContentSpec,
  VideoBlock as BlockNoteVideoBlock,
  VideoToExternalHTML,
} from '@blocknote/react'
import { lazy, Suspense, useEffect, useRef, useState, type ComponentProps, type KeyboardEvent } from 'react'
import { MATH_BLOCK_TYPE, MATH_INLINE_TYPE, renderMathToHtml } from '@/kernel/markdown/math-markdown'
import { MERMAID_BLOCK_TYPE, mermaidFenceSource } from '@/kernel/markdown/mermaid-markdown'
import { TLDRAW_BLOCK_TYPE, TLDRAW_DEFAULT_HEIGHT } from '@/kernel/markdown/tldraw-markdown'
import { HTML_BLOCK_DEFAULT_HEIGHT, HTML_BLOCK_TYPE } from '@/kernel/markdown/html-block-markdown'
import { MARKDOWN_HIGHLIGHT_STYLE } from '@/kernel/markdown/markdown-highlight-markdown'
import { createCodeBlockOptions } from './code-block-options'
import { HtmlBlock } from './html-block'
import { MermaidDiagram } from './mermaid-diagram'
import { SafeHtmlSpan } from './safe-markup'
import { updateTldrawBlockPropsSafely } from './tldraw-block-props'
import { useExternalMediaPreview } from '@/platform/media-preview-runtime'
import { Button } from '@/ui/button'
import { Textarea } from '@/ui/textarea'
import { dispatchRichEditorExternalChange } from './editor-external-change-events'
import { CalloutBlockSpec } from './callout-block'
import {
  isStaleBlockReferenceError,
  reportRecoveredEditorTransformError,
} from './rich-editor-transform-error-recovery-extension'

const TldrawWhiteboard = lazy(() => import('./tldraw-whiteboard').then(module => ({
  default: module.TldrawWhiteboard,
})))
type AudioBlockProps = ComponentProps<typeof BlockNoteAudioBlock>
type VideoBlockProps = ComponentProps<typeof BlockNoteVideoBlock>
type MediaBlockPreviewProps = {
  block: {
    props: {
      showPreview: boolean
    }
  }
}

/** Inert wikilink renderer: `[[target]]` / `[[target|alias]]` text round-trips losslessly
 *  through the schema, but Fuwa has no wikilink UI, so it renders as plain text. */
function wikilinkDisplayText(target: string): string {
  const pipeIdx = target.indexOf('|')
  return pipeIdx === -1 ? target : target.slice(pipeIdx + 1)
}

export const WikiLink = createReactInlineContentSpec(
  {
    type: "wikilink" as const,
    propSchema: {
      target: { default: "" },
    },
    content: "none",
  },
  {
    render: (props) => {
      const target = props.inlineContent.props.target
      return (
        <span className="wikilink" data-target={target}>
          {wikilinkDisplayText(target)}
        </span>
      )
    },
  }
)

function MathRender({ latex, displayMode }: { latex: string; displayMode: boolean }) {
  const source = displayMode ? `$$\n${latex}\n$$` : `$${latex}$`
  return (
    <SafeHtmlSpan
      aria-label={`Math: ${latex}`}
      className={displayMode ? 'math math--block' : 'math math--inline'}
      data-latex={latex}
      markup={renderMathToHtml({ latex, displayMode })}
      role="img"
      title={source}
    />
  )
}

type MathBlockEditorProps = {
  block: {
    id: string
    props: {
      latex: string
    }
  }
  editor: {
    domElement?: EventTarget | null
    focus?: () => void
    updateBlock: (blockId: string, update: { props: { latex: string } }) => void
  }
}

function stopMathEditorEvent(event: { stopPropagation: () => void }) {
  event.stopPropagation()
}

function isCommandModifierPressed(event: KeyboardEvent<HTMLTextAreaElement>): boolean {
  return event.metaKey || event.ctrlKey
}

function isCommitMathEditShortcut(event: KeyboardEvent<HTMLTextAreaElement>): boolean {
  return event.key === 'Enter' && isCommandModifierPressed(event)
}

function updateMathBlockLatexSafely(
  editor: MathBlockEditorProps['editor'],
  blockId: string,
  latex: string,
) {
  try {
    editor.updateBlock(blockId, { props: { latex } })
    return true
  } catch (error) {
    if (!isStaleBlockReferenceError(error)) throw error

    reportRecoveredEditorTransformError('stale_block_reference', error)
    return false
  }
}

export function MathBlockEditor({ block, editor }: MathBlockEditorProps) {
  const currentLatex = block.props.latex
  const editingSessionRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [draftLatex, setDraftLatex] = useState(currentLatex)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) return
    textareaRef.current?.focus()
    textareaRef.current?.select()
  }, [editing])

  const startEditing = (event: { preventDefault: () => void; stopPropagation: () => void }) => {
    event.preventDefault()
    event.stopPropagation()
    setDraftLatex(currentLatex)
    editingSessionRef.current = true
    setEditing(true)
  }

  const finishEditing = () => {
    if (!editingSessionRef.current) return
    editingSessionRef.current = false
    setEditing(false)
    if (draftLatex !== currentLatex) {
      const updated = updateMathBlockLatexSafely(editor, block.id, draftLatex)
      if (updated) dispatchRichEditorExternalChange(editor, editor.domElement ?? undefined)
    }
    editor.focus?.()
  }

  const cancelEditing = () => {
    if (!editingSessionRef.current) return
    editingSessionRef.current = false
    setDraftLatex(currentLatex)
    setEditing(false)
    editor.focus?.()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      cancelEditing()
      return
    }

    if (isCommitMathEditShortcut(event)) {
      event.preventDefault()
      event.stopPropagation()
      finishEditing()
    }
  }

  if (editing) {
    return (
      <div className="math-block-shell math-block-shell--editing">
        <div contentEditable={false}>
          <Textarea
            ref={textareaRef}
            aria-label={`Math: ${currentLatex}`}
            className="math-block-source min-h-24 font-mono text-sm selection:bg-state-selection selection:text-text-primary focus-visible:ring-0"
            value={draftLatex}
            onBlur={finishEditing}
            onChange={(event) => setDraftLatex(event.target.value)}
            onKeyDown={handleKeyDown}
            onMouseDown={stopMathEditorEvent}
          />
        </div>
      </div>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className="math-block-shell h-auto min-h-9"
      onDoubleClick={startEditing}
    >
      <MathRender latex={currentLatex} displayMode />
    </Button>
  )
}

export const MathInline = createReactInlineContentSpec(
  {
    type: MATH_INLINE_TYPE,
    propSchema: {
      latex: { default: '' },
    },
    content: 'none',
  },
  {
    render: (props) => (
      <MathRender latex={props.inlineContent.props.latex} displayMode={false} />
    ),
  },
)

const MathBlock = createReactBlockSpec(
  {
    type: MATH_BLOCK_TYPE,
    propSchema: {
      latex: { default: '' },
    },
    content: 'none',
  },
  {
    render: (props) => (
      <MathBlockEditor block={props.block} editor={props.editor} />
    ),
  },
)

function readCodeElementLanguage(code: Element): string | null {
  const language = code.getAttribute('data-language')
    ?? Array.from(code.classList)
      .find(className => className.startsWith('language-'))
      ?.replace(/^language-/u, '')
  if (!language) return null

  return language.trim().split(/\s+/u)[0]?.toLowerCase() ?? null
}

function readMermaidPreElement(element: HTMLElement): { source: string; diagram: string } | undefined {
  if (element.tagName !== 'PRE') return undefined
  if (element.childElementCount !== 1 || element.firstElementChild?.tagName !== 'CODE') return undefined

  const code = element.firstElementChild
  if (readCodeElementLanguage(code) !== 'mermaid') return undefined

  const diagram = code.textContent?.endsWith('\n')
    ? code.textContent
    : `${code.textContent ?? ''}\n`
  return {
    diagram,
    source: mermaidFenceSource({ diagram }),
  }
}

function readHtmlPreElement(element: HTMLElement): { height: string; html: string } | undefined {
  if (element.tagName !== 'PRE') return undefined
  if (element.childElementCount !== 1 || element.firstElementChild?.tagName !== 'CODE') return undefined

  const code = element.firstElementChild
  if (readCodeElementLanguage(code) !== 'html') return undefined

  const html = code.textContent?.endsWith('\n')
    ? code.textContent
    : `${code.textContent ?? ''}\n`
  return {
    height: HTML_BLOCK_DEFAULT_HEIGHT,
    html,
  }
}

const MermaidBlock = createReactBlockSpec(
  {
    type: MERMAID_BLOCK_TYPE,
    propSchema: {
      source: { default: '' },
      diagram: { default: '' },
    },
    content: 'none',
  },
  {
    runsBefore: ['codeBlock'],
    parse: readMermaidPreElement,
    render: (props) => (
      <MermaidDiagram
        diagram={props.block.props.diagram}
        source={props.block.props.source}
      />
    ),
  },
)

export function mediaBlockPropsForPreviewRuntime<T extends MediaBlockPreviewProps>(
  props: T,
  externalMediaPreview: boolean,
): T {
  if (!externalMediaPreview) return props

  return {
    ...props,
    block: {
      ...props.block,
      props: {
        ...props.block.props,
        showPreview: false,
      },
    },
  }
}

export function AudioBlock(props: AudioBlockProps) {
  const externalMediaPreview = useExternalMediaPreview()
  return <BlockNoteAudioBlock {...mediaBlockPropsForPreviewRuntime(props, externalMediaPreview)} />
}

export function VideoBlock(props: VideoBlockProps) {
  const externalMediaPreview = useExternalMediaPreview()
  return <BlockNoteVideoBlock {...mediaBlockPropsForPreviewRuntime(props, externalMediaPreview)} />
}

const AudioBlockSpec = createReactBlockSpec(
  createAudioBlockConfig,
  (config) => ({
    render: AudioBlock,
    parse: audioParse(config),
    toExternalHTML: AudioToExternalHTML,
    runsBefore: ['file'],
  }),
)

const VideoBlockSpec = createReactBlockSpec(
  createVideoBlockConfig,
  (config) => ({
    render: VideoBlock,
    parse: videoParse(config),
    toExternalHTML: VideoToExternalHTML,
    runsBefore: ['file'],
  }),
)

const TldrawBlock = createReactBlockSpec(
  {
    type: TLDRAW_BLOCK_TYPE,
    propSchema: {
      boardId: { default: '' },
      height: { default: TLDRAW_DEFAULT_HEIGHT },
      snapshot: { default: '{}' },
      width: { default: '' },
    },
    content: 'none',
  },
  {
    runsBefore: ['codeBlock'],
    meta: { selectable: false },
    render: (props) => (
      <Suspense fallback={<div className="tldraw-whiteboard tldraw-whiteboard--loading" />}>
        <TldrawWhiteboard
          boardId={props.block.props.boardId}
          height={props.block.props.height}
          snapshot={props.block.props.snapshot}
          width={props.block.props.width}
          onSnapshotChange={(snapshot) => {
            updateTldrawBlockPropsSafely({
              blockId: props.block.id,
              editor: props.editor,
              nextProps: (currentProps) => ({
                ...currentProps,
                snapshot,
              }),
            })
          }}
          onSizeChange={(size) => {
            updateTldrawBlockPropsSafely({
              blockId: props.block.id,
              editor: props.editor,
              nextProps: (currentProps) => ({
                ...currentProps,
                height: size.height,
                width: size.width,
              }),
            })
          }}
        />
      </Suspense>
    ),
  },
)

const HtmlBlockSpec = createReactBlockSpec(
  {
    type: HTML_BLOCK_TYPE,
    propSchema: {
      height: { default: '320' },
      html: { default: '' },
      scripts: { default: 'blocked' },
    },
    content: 'none',
  },
  {
    runsBefore: ['codeBlock'],
    meta: { selectable: false },
    parse: readHtmlPreElement,
    render: (props) => (
      <HtmlBlock block={props.block} editor={props.editor} />
    ),
  },
)

const codeBlock = createCodeBlockSpec(createCodeBlockOptions())
const audioBlock = AudioBlockSpec()
const htmlBlock = HtmlBlockSpec()
const mathBlock = MathBlock()
const mermaidBlock = MermaidBlock()
const tldrawBlock = TldrawBlock()
const videoBlock = VideoBlockSpec()

const calloutBlock = CalloutBlockSpec()

function markdownHighlightElement(): { dom: HTMLElement; contentDOM: HTMLElement } {
  const mark = document.createElement('mark')
  mark.className = 'markdown-highlight'
  return { dom: mark, contentDOM: mark }
}

const MarkdownHighlightStyle = createStyleSpec(
  {
    type: MARKDOWN_HIGHLIGHT_STYLE,
    propSchema: 'boolean',
  },
  {
    render: markdownHighlightElement,
    toExternalHTML: markdownHighlightElement,
    parse: element => element.tagName === 'MARK' ? true : undefined,
  },
)

export const schema = BlockNoteSchema.create({
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    wikilink: WikiLink,
    mathInline: MathInline,
  },
}).extend({
  styleSpecs: {
    [MARKDOWN_HIGHLIGHT_STYLE]: MarkdownHighlightStyle,
  },
  blockSpecs: {
    audio: audioBlock,
    calloutBlock,
    htmlBlock,
    mathBlock,
    mermaidBlock,
    tldrawBlock,
    codeBlock,
    video: videoBlock,
  },
})
