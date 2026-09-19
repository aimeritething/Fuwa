import { createExtension } from '@blocknote/core'
import type { Transaction } from '@tiptap/pm/state'
import {
  consumeKeyboardEvent,
  createCaptureKeydownMount,
  isComposingKeyboardEvent,
  type RichEditorView,
} from './rich-editor-keyboard'

const CODE_BLOCK_TYPE = 'codeBlock'
const CODE_BLOCK_INDENT = '  '
const LINE_INDENT_PATTERN = /^(?:\t| {1,2})/
// Stands in for an inline node that has no text, so a text offset stays a document offset.
const LEAF_PLACEHOLDER = '\ufffc'

type CodeBlockTabEditor = {
  _tiptapEditor?: { view: RichEditorView }
  getTextCursorPosition: () => { block: { type: unknown } }
  isEditable?: boolean
  prosemirrorView?: RichEditorView
  transact: (callback: (transaction: Transaction) => boolean) => boolean
}
type CodeBlockTabEvent = Pick<
  KeyboardEvent,
  'altKey'
  | 'ctrlKey'
  | 'isComposing'
  | 'key'
  | 'keyCode'
  | 'metaKey'
  | 'preventDefault'
  | 'shiftKey'
  | 'stopImmediatePropagation'
>

/** Tab, or Shift+Tab: no other modifier. */
function isTabKey(event: CodeBlockTabEvent): boolean {
  return event.key === 'Tab'
    && !event.altKey
    && !event.ctrlKey
    && !event.metaKey
}

function isEditable(editor: CodeBlockTabEditor): boolean {
  return editor.isEditable !== false
}

function readCurrentBlockType(editor: CodeBlockTabEditor): string | null {
  try {
    const position = editor.getTextCursorPosition()
    return typeof position.block.type === 'string' ? position.block.type : null
  } catch {
    return null
  }
}

function isCodeBlockCursor(editor: CodeBlockTabEditor): boolean {
  return readCurrentBlockType(editor) === CODE_BLOCK_TYPE
}

/**
 * The offsets, in the code block's text, where the lines the selection touches
 * begin. A line the selection only reaches the start of is not one of them.
 */
function selectedLineStarts(text: string, from: number, to: number): number[] {
  const starts = [text.lastIndexOf('\n', from - 1) + 1]
  for (let lineBreak = text.indexOf('\n', from); lineBreak !== -1 && lineBreak + 1 < Math.max(to, from + 1); lineBreak = text.indexOf('\n', lineBreak + 1)) {
    starts.push(lineBreak + 1)
  }
  return starts
}

/**
 * Tab at a cursor inserts one indent. With a selection it indents every line
 * the selection touches, and Shift+Tab takes one indent (a tab, or up to two
 * spaces) off each: the selected text is never replaced. One transaction, so
 * one undo step. A selection that leaves the code block is left as it is:
 * BlockNote's own Tab would replace it with an indent.
 */
function indentCodeBlock(editor: CodeBlockTabEditor, outdent: boolean): boolean {
  return editor.transact((tr) => {
    const { $from, $to, empty } = tr.selection
    if ($from.parent.type.name !== CODE_BLOCK_TYPE) return false
    if (!$from.sameParent($to)) return true

    if (empty && !outdent) {
      tr.insertText(CODE_BLOCK_INDENT)
      return true
    }

    const codeBlock = $from.parent
    const blockStart = $from.start()
    const text = codeBlock.textBetween(0, codeBlock.content.size, undefined, LEAF_PLACEHOLDER)
    // Last line first, so an edit never moves a line start that is still to come.
    for (const lineStart of selectedLineStarts(text, $from.parentOffset, $to.parentOffset).reverse()) {
      const position = blockStart + lineStart
      if (!outdent) {
        tr.insertText(CODE_BLOCK_INDENT, position)
        continue
      }
      const indent = LINE_INDENT_PATTERN.exec(text.slice(lineStart))?.[0]
      if (indent) tr.delete(position, position + indent.length)
    }
    return true
  })
}

function shouldHandleCodeBlockTab(
  event: CodeBlockTabEvent,
  editor: CodeBlockTabEditor,
  view?: RichEditorView | null,
): boolean {
  return isTabKey(event)
    && isEditable(editor)
    && !isComposingKeyboardEvent(event, view)
    && isCodeBlockCursor(editor)
}

export const createRichEditorCodeBlockTabExtension = createExtension(({ editor }) => {
  const richEditor = editor as CodeBlockTabEditor

  return {
    key: 'richEditorCodeBlockTab',
    mount: createCaptureKeydownMount(richEditor, (event, view) => {
      if (!shouldHandleCodeBlockTab(event, richEditor, view)) return
      if (indentCodeBlock(richEditor, event.shiftKey)) consumeKeyboardEvent(event)
    }),
  } as const
})
