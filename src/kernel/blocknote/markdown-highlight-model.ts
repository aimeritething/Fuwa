import type { useCreateBlockNote } from '@blocknote/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { trackEvent } from '@/lib/telemetry'
import { dispatchRichEditorExternalChange } from './editor-external-change-events'
import {
  DEFAULT_MARKDOWN_HIGHLIGHT_COLOR,
  type MarkdownHighlightColor,
} from '@/kernel/markdown/markdown-highlight-markdown'
import { selectionOrHighlightRange } from './markdown-highlight-range'

export type HighlightEditor = ReturnType<typeof useCreateBlockNote>
export type HighlightRange = { from: number; to: number }

export type MarkdownHighlightRange = HighlightRange & {
  color: MarkdownHighlightColor
}

export type HighlightControlSource = 'cursor' | 'toolbar'

function validRange(editor: HighlightEditor, range: HighlightRange | null): range is HighlightRange {
  if (!range) return false
  return range.from >= 0
    && range.to > range.from
    && range.to <= editor.prosemirrorState.doc.content.size
}

// True when every text node in the range carries the highlight mark. A
// selection that only overlaps a highlight is not highlighted yet, so the
// toggle extends it, as the bold toggle does.
function rangeIsHighlighted(editor: HighlightEditor, range: HighlightRange): boolean {
  const { doc, schema } = editor.prosemirrorState
  const highlightMark = schema.marks.highlight
  if (!highlightMark) return false

  let sawText = false
  let highlighted = true
  doc.nodesBetween(range.from, range.to, (node: ProseMirrorNode) => {
    if (!node.isText) return highlighted
    sawText = true
    if (!highlightMark.isInSet(node.marks)) highlighted = false
    return highlighted
  })
  return sawText && highlighted
}

function updateHighlightMarks(
  editor: HighlightEditor,
  range: HighlightRange,
  color: MarkdownHighlightColor | null,
) {
  const { schema, tr } = editor.prosemirrorState
  const highlightMark = schema.marks.highlight
  const backgroundColorMark = schema.marks.backgroundColor
  if (!highlightMark || !backgroundColorMark) return

  let transaction = tr.removeMark(range.from, range.to, backgroundColorMark)
  if (color === null) {
    transaction = transaction.removeMark(range.from, range.to, highlightMark)
  } else {
    transaction = transaction.addMark(range.from, range.to, highlightMark.create())
    if (color !== DEFAULT_MARKDOWN_HIGHLIGHT_COLOR) {
      transaction = transaction.addMark(
        range.from,
        range.to,
        backgroundColorMark.create({ stringValue: color }),
      )
    }
  }

  editor.prosemirrorView.dispatch(transaction.scrollIntoView())
  dispatchRichEditorExternalChange(editor, editor.domElement ?? undefined)
  editor.focus()
}

export function applyMarkdownHighlightColor(
  editor: HighlightEditor,
  color: MarkdownHighlightColor,
  range: HighlightRange | null,
  source: HighlightControlSource,
) {
  if (!validRange(editor, range)) return

  updateHighlightMarks(editor, range, color)
  trackEvent('markdown_highlight_color_selected', { color, source })
}

export function toggleDefaultMarkdownHighlight(editor: HighlightEditor) {
  const range = selectionOrHighlightRange(editor)

  if (validRange(editor, range)) {
    updateHighlightMarks(
      editor,
      range,
      rangeIsHighlighted(editor, range) ? null : DEFAULT_MARKDOWN_HIGHLIGHT_COLOR,
    )
    return
  }

  editor.focus()
  editor.removeStyles({ backgroundColor: 'default' })
  editor.toggleStyles({ highlight: true })
}
