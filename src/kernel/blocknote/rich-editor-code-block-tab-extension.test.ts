import { BlockNoteEditor } from '@blocknote/core'
import { TextSelection } from '@tiptap/pm/state'
import { afterEach, describe, expect, it } from 'vitest'
import { schema } from './editor-schema'
import { createRichEditorCodeBlockTabExtension } from './rich-editor-code-block-tab-extension'

type TestEditor = ReturnType<typeof createMountedEditor>

const mounted: TestEditor[] = []

function createMountedEditor() {
  const editor = BlockNoteEditor.create({
    schema,
    extensions: [createRichEditorCodeBlockTabExtension()],
  })
  const host = document.createElement('div')
  document.body.appendChild(host)
  editor.mount(host)
  mounted.push(editor)
  return editor
}

/** An editor whose first block is a code block holding `code`, and the position of its first character. */
function createCodeBlockEditor(code: string) {
  const editor = createMountedEditor()
  editor.replaceBlocks(editor.document, [
    { type: 'codeBlock', content: code },
    { type: 'paragraph', content: 'after' },
  ])

  let start = -1
  editor._tiptapEditor.state.doc.descendants((node, pos) => {
    if (start === -1 && node.type.name === 'codeBlock') start = pos + 1
  })
  if (start === -1) throw new Error('the code block did not load')
  return { editor, start }
}

function select(editor: TestEditor, anchor: number, head = anchor) {
  const view = editor._tiptapEditor.view
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, anchor, head)))
}

function pressTab(editor: TestEditor, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true, ...init })
  editor._tiptapEditor.view.dom.dispatchEvent(event)
  return event
}

function codeOf(editor: TestEditor): string {
  let code = ''
  editor._tiptapEditor.state.doc.descendants((node) => {
    if (node.type.name === 'codeBlock') code = node.textContent
  })
  return code
}

function selectedText(editor: TestEditor): string {
  const { doc, selection } = editor._tiptapEditor.state
  return doc.textBetween(selection.from, selection.to, '\n')
}

describe('Tab in a Rich code block', () => {
  afterEach(() => {
    for (const editor of mounted.splice(0)) editor._tiptapEditor.destroy()
  })

  it('inserts an indent at the cursor', () => {
    const { editor, start } = createCodeBlockEditor('ab')
    select(editor, start + 1)

    const event = pressTab(editor)

    expect(codeOf(editor)).toBe('a  b')
    expect(event.defaultPrevented).toBe(true)
  })

  it('indents every line a selection touches, and keeps the selection', () => {
    const { editor, start } = createCodeBlockEditor('one\ntwo\nthree\nfour')
    // From inside "two" to inside "three".
    select(editor, start + 5, start + 10)

    pressTab(editor)

    expect(codeOf(editor)).toBe('one\n  two\n  three\nfour')
    expect(selectedText(editor)).toBe('wo\n  th')
  })

  it('does not indent a line the selection only reaches the start of', () => {
    const { editor, start } = createCodeBlockEditor('one\ntwo\nthree')
    select(editor, start, start + 4)

    pressTab(editor)

    expect(codeOf(editor)).toBe('  one\ntwo\nthree')
  })

  it('outdents every selected line by one level on Shift+Tab', () => {
    const code = '    four\n  two\n one\n\ttab\nnone'
    const { editor, start } = createCodeBlockEditor(code)
    select(editor, start, start + code.length)

    const event = pressTab(editor, { shiftKey: true })

    expect(codeOf(editor)).toBe('  four\ntwo\none\ntab\nnone')
    expect(event.defaultPrevented).toBe(true)
  })

  it('outdents the cursor\'s line on Shift+Tab', () => {
    const { editor, start } = createCodeBlockEditor('one\n  two')
    select(editor, start + 8)

    pressTab(editor, { shiftKey: true })

    expect(codeOf(editor)).toBe('one\ntwo')
  })

  it('keeps Shift+Tab inside the code block when there is nothing to outdent', () => {
    const { editor, start } = createCodeBlockEditor('one')
    select(editor, start + 1)

    const event = pressTab(editor, { shiftKey: true })

    expect(codeOf(editor)).toBe('one')
    expect(event.defaultPrevented).toBe(true)
  })

  it('undoes a multi-line indent in one step', () => {
    const { editor, start } = createCodeBlockEditor('one\ntwo\nthree')
    select(editor, start, start + 13)

    pressTab(editor)
    expect(codeOf(editor)).toBe('  one\n  two\n  three')

    editor.undo()
    expect(codeOf(editor)).toBe('one\ntwo\nthree')
  })

  it('leaves Tab alone outside a code block', () => {
    const editor = createMountedEditor()
    editor.replaceBlocks(editor.document, [{ type: 'paragraph', content: 'text' }])
    editor.setTextCursorPosition(editor.document[0], 'end')

    pressTab(editor)

    expect(editor._tiptapEditor.state.doc.textContent).toBe('text')
  })

  it('changes nothing when the selection runs out of the code block', () => {
    const { editor, start } = createCodeBlockEditor('one\ntwo')
    const docEnd = editor._tiptapEditor.state.doc.content.size
    select(editor, start + 1, TextSelection.near(editor._tiptapEditor.state.doc.resolve(docEnd), -1).head)

    const event = pressTab(editor)

    expect(codeOf(editor)).toBe('one\ntwo')
    expect(editor._tiptapEditor.state.doc.textContent).toBe('one\ntwoafter')
    expect(event.defaultPrevented).toBe(true)
  })

  it('leaves composing and read-only editors alone', () => {
    const composing = createCodeBlockEditor('ab')
    select(composing.editor, composing.start + 1)
    composing.editor._tiptapEditor.view.dom.dispatchEvent(new CompositionEvent('compositionstart'))
    pressTab(composing.editor, { isComposing: true })
    expect(codeOf(composing.editor)).toBe('ab')

    const readOnly = createCodeBlockEditor('ab')
    select(readOnly.editor, readOnly.start + 1)
    readOnly.editor.isEditable = false
    pressTab(readOnly.editor)
    expect(codeOf(readOnly.editor)).toBe('ab')
  })
})
