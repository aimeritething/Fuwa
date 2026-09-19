import { BlockNoteEditor } from '@blocknote/core'
import { TextSelection } from '@tiptap/pm/state'
import { afterEach, describe, expect, it } from 'vitest'
import { schema } from '@/kernel/blocknote/editor-schema'
import {
  injectRichEditorMarkdownBlocks,
  installRichEditorMarkdownSerializer,
  preProcessRichEditorMarkdown,
} from '@/kernel/markdown/rich-editor-markdown'
import {
  buildCodeMirrorRestoreState,
  captureRawEditorPositionSnapshot,
  captureRichEditorPositionSnapshot,
  restoreBlockNoteView,
  type BlockNotePositionEditor,
  type CodeMirrorViewLike,
} from './editor-mode-position'

// The Rich ↔ Raw position mapping on a real editor and a real Document: where
// the cursor lands in Raw, and that a round trip brings it back.

const FRONTMATTER = '---\ntitle: Demo\n---\n'
const BODY = [
  '# Tables',
  '',
  'A first paragraph with **bold** text and a [link](https://example.com).',
  '',
  '## Eight columns',
  '',
  '| Day | Mon | Tue |',
  '| --- | --- | --- |',
  '| Morning | Writing | Review |',
  '| Afternoon | Meetings | Writing |',
  '| Evening | Reading | Run |',
  '',
  '## Long text in cells',
  '',
  '- first item',
  '- second item',
  '  - nested item',
  '  - nested sibling',
  '- third item',
  '',
  '```ts',
  'const one = 1',
  'const two = 2',
  '```',
  '',
  'See [[Project Alpha]] for the plan.',
  '',
  'The last paragraph.',
].join('\n')
const CONTENT = FRONTMATTER + BODY

type TestEditor = Awaited<ReturnType<typeof openRich>>

const mounted: Array<{ _tiptapEditor: { destroy: () => void } }> = []

async function openRich(body: string) {
  const editor = BlockNoteEditor.create({ schema })
  installRichEditorMarkdownSerializer(editor)
  const host = document.createElement('div')
  document.body.appendChild(host)
  editor.mount(host)
  mounted.push(editor)

  const parsed = await editor.tryParseMarkdownToBlocks(preProcessRichEditorMarkdown(body))
  editor.replaceBlocks(editor.document, injectRichEditorMarkdownBlocks(parsed as never) as never)
  return editor
}

function positionEditor(editor: TestEditor) {
  return editor as unknown as BlockNotePositionEditor
}

function blockWithText(editor: TestEditor, text: string) {
  const block = editor.document.find((candidate) => JSON.stringify(candidate.content).includes(text))
  if (!block) throw new Error(`no block holds "${text}"`)
  return block
}

/** Puts a collapsed cursor right after `text`, wherever in the Document it is. */
function putCursorAfter(editor: TestEditor, text: string) {
  const view = editor._tiptapEditor.view
  let target = -1
  view.state.doc.descendants((node, pos) => {
    if (target !== -1 || !node.isText || !node.text) return
    const index = node.text.indexOf(text)
    if (index !== -1) target = pos + index + text.length
  })
  if (target === -1) throw new Error(`"${text}" is not in the Document`)
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, target)))
}

function switchToRaw(editor: TestEditor) {
  const snapshot = captureRichEditorPositionSnapshot(positionEditor(editor))
  if (!snapshot) throw new Error('no Rich position was captured')
  const state = buildCodeMirrorRestoreState(positionEditor(editor), CONTENT, snapshot)
  if (!state) throw new Error('no Raw position was built')
  return state
}

function lineAt(content: string, offset: number) {
  const start = content.lastIndexOf('\n', offset - 1) + 1
  const nextBreak = content.indexOf('\n', offset)
  const end = nextBreak === -1 ? content.length : nextBreak
  return { text: content.slice(start, end), atLineEnd: offset === end }
}

/** Stands in for the Raw editor, with its selection where the switch put it. */
function installRawView(selection: { anchor: number; head: number }) {
  const view: CodeMirrorViewLike = {
    state: { doc: { toString: () => CONTENT }, selection: { main: selection } },
    scrollDOM: { scrollTop: 0 },
    dispatch: () => {},
    focus: () => {},
  }
  const host = document.createElement('div')
  host.setAttribute('data-testid', 'raw-editor-codemirror')
  Object.assign(host, { __cmView: view })
  document.body.appendChild(host)
}

function switchBackToRich(editor: TestEditor, selection: { anchor: number; head: number }) {
  installRawView(selection)
  const snapshot = captureRawEditorPositionSnapshot(document)
  if (!snapshot) throw new Error('no Raw position was captured')
  expect(restoreBlockNoteView(positionEditor(editor), snapshot, document)).toBe(true)
}

function textBeforeCursor(editor: TestEditor) {
  const { $head } = editor._tiptapEditor.state.selection
  return $head.parent.textBetween(0, $head.parentOffset)
}

describe('switching between Rich and Raw on a real Document', () => {
  afterEach(() => {
    for (const editor of mounted.splice(0)) editor._tiptapEditor.destroy()
    document.body.innerHTML = ''
  })

  it.each([
    ['a table cell', 'Meetings', '| Afternoon | Meetings | Writing |'],
    ['the table\'s header row', 'Mon', '| Day | Mon | Tue |'],
    ['the middle of a paragraph', 'with', 'A first paragraph with **bold** text and a [link](https://example.com).'],
    ['a list item', 'second', '- second item'],
    ['a nested list item', 'nested it', '  - nested item'],
    ['a heading', 'Eight', '## Eight columns'],
    ['a paragraph with a wikilink', 'See', 'See [[Project Alpha]] for the plan.'],
    ['a code block', 'const one', 'const two = 2'],
  ])('puts a collapsed cursor at the end of the matching Raw line from %s', async (_, cursorAfter, rawLine) => {
    const editor = await openRich(BODY)
    putCursorAfter(editor, cursorAfter)

    const state = switchToRaw(editor)

    expect(state.anchor).toBe(state.head)
    expect(lineAt(CONTENT, state.head)).toEqual({ text: rawLine, atLineEnd: true })
  })

  it('keeps a selection over several blocks as a Raw selection', async () => {
    const editor = await openRich(BODY)
    editor.setSelection(blockWithText(editor, 'first paragraph').id, blockWithText(editor, 'Eight columns').id)

    const state = switchToRaw(editor)

    expect(CONTENT.slice(state.anchor, state.head)).toBe(
      'A first paragraph with **bold** text and a [link](https://example.com).\n\n## Eight columns',
    )
  })

  it('turns a selection inside one block into a cursor, so typing replaces nothing', async () => {
    const editor = await openRich(BODY)
    const view = editor._tiptapEditor.view
    putCursorAfter(editor, 'first')
    const { head } = view.state.selection
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, head - 5, head)))

    const state = switchToRaw(editor)

    expect(state.anchor).toBe(state.head)
  })

  it.each([
    ['a table cell', 'Meetings', 'Writing'],
    ['the middle of a paragraph', 'with', 'A first paragraph with bold text and a link.'],
    ['a list item', 'second', 'second item'],
    ['a nested list item', 'nested it', 'nested item'],
    ['a code block', 'const one', 'const one = 1\nconst two = 2'],
  ])('comes back from Raw to the same place from %s', async (_, cursorAfter, textBefore) => {
    const editor = await openRich(BODY)
    putCursorAfter(editor, cursorAfter)
    const rawState = switchToRaw(editor)
    putCursorAfter(editor, 'The last')

    switchBackToRich(editor, rawState)

    expect(editor._tiptapEditor.state.selection.empty).toBe(true)
    expect(textBeforeCursor(editor)).toBe(textBefore)
  })

  it('lands in the table row the Raw cursor is on', async () => {
    const editor = await openRich(BODY)
    const offset = CONTENT.indexOf('| Evening') + 3

    switchBackToRich(editor, { anchor: offset, head: offset })

    expect(textBeforeCursor(editor)).toBe('Run')
  })

  it('lands in the header row from the table\'s delimiter line', async () => {
    const editor = await openRich(BODY)
    const offset = CONTENT.indexOf('| --- |') + 2

    switchBackToRich(editor, { anchor: offset, head: offset })

    expect(textBeforeCursor(editor)).toBe('Tue')
  })
})
