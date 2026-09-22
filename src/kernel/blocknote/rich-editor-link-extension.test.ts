import { BlockNoteEditor } from '@blocknote/core'
import { afterEach, describe, expect, it } from 'vitest'
import { schema } from './editor-schema'
import { serializeDurableEditorBlocks } from '@/kernel/markdown/editor-durable-markdown'
import { RICH_EDITOR_BLOCKNOTE_OPTIONS } from './rich-editor-block-note-options'
import { isAllowedLinkHref } from './rich-editor-link-extension'

type TestEditor = ReturnType<typeof createMountedEditor>

const mounted: TestEditor[] = []

function createMountedEditor() {
  const editor = BlockNoteEditor.create({ ...RICH_EDITOR_BLOCKNOTE_OPTIONS, schema })
  const host = document.createElement('div')
  document.body.appendChild(host)
  editor.mount(host)
  mounted.push(editor)
  return editor
}

/** One transaction per character, as the keyboard sends them. */
function type(editor: TestEditor, text: string) {
  for (const char of text) {
    const view = editor._tiptapEditor.view
    view.dispatch(view.state.tr.insertText(char))
  }
}

function linkHrefs(editor: TestEditor): string[] {
  const hrefs: string[] = []
  editor._tiptapEditor.state.doc.descendants((node) => {
    for (const mark of node.marks) {
      if (mark.type.name === 'link') hrefs.push(mark.attrs.href as string)
    }
  })
  return hrefs
}

function text(editor: TestEditor): string {
  return editor._tiptapEditor.state.doc.textContent
}

async function load(editor: TestEditor, markdown: string) {
  const blocks = await editor.tryParseMarkdownToBlocks(markdown)
  editor.replaceBlocks(editor.document, blocks)
}

describe('the Rich editor link mark', () => {
  afterEach(() => {
    for (const editor of mounted.splice(0)) editor._tiptapEditor.destroy()
  })

  it('installs one link mark: Plumo\'s, in place of BlockNote\'s', () => {
    const editor = createMountedEditor()
    const names = editor._tiptapEditor.extensionManager.extensions.map((extension) => extension.name)

    expect(names.filter((name) => name === 'link')).toHaveLength(1)
  })

  it.each([
    'see AGENTS.md ',
    'run install.sh ',
    'in docs/a.md ',
    'in ./notes.txt ',
  ])('leaves the file name in "%s" as plain text', (typed) => {
    const editor = createMountedEditor()
    type(editor, typed)

    expect(text(editor)).toBe(typed)
    expect(linkHrefs(editor)).toEqual([])
  })

  it.each([
    ['see example.com ', 'https://example.com'],
    ['see https://example.com ', 'https://example.com'],
    ['see https://AGENTS.md ', 'https://AGENTS.md'],
  ])('still links the web address in "%s"', (typed, href) => {
    const editor = createMountedEditor()
    type(editor, typed)

    expect(linkHrefs(editor)).toEqual([href])
  })

  it('keeps the writer\'s relative links through an edit elsewhere', async () => {
    const editor = createMountedEditor()
    await load(editor, [
      '[CHANGELOG.md](CHANGELOG.md) [docs/a.md](docs/a.md) [./a.md](./a.md) [AGENTS.md](https://AGENTS.md)',
      '',
      'hello',
    ].join('\n'))
    const paragraph = editor.document.at(1)
    if (!paragraph) throw new Error('the second paragraph did not load')

    editor.setTextCursorPosition(paragraph, 'end')
    type(editor, ' world')

    expect(linkHrefs(editor)).toEqual(['CHANGELOG.md', 'docs/a.md', './a.md', 'https://AGENTS.md'])
  })

  it.each([
    '[guide](docs/guide.md)',
    '[guide](a/b/guide.md#install)',
    '[guide](./docs/guide.md)',
    '[guide](../guide.md)',
    '[docs/a.md](docs/a.md)',
  ])('opens and saves %s with its link', async (markdown) => {
    const editor = createMountedEditor()
    await load(editor, markdown)

    expect(serializeDurableEditorBlocks(editor, editor.document).trim()).toBe(markdown)
  })

  it('undoes past a typed file name, and redoes it', () => {
    const editor = createMountedEditor()
    type(editor, 'see AGENTS.md ')
    type(editor, 'more')

    for (let press = 0; press < 10; press++) editor.undo()
    expect(text(editor)).toBe('')

    for (let press = 0; press < 10; press++) editor.redo()
    expect(text(editor)).toBe('see AGENTS.md more')
    expect(linkHrefs(editor)).toEqual([])
  })
})

describe('isAllowedLinkHref', () => {
  const tiptapRefuses = () => false

  it.each(['docs/a.md', 'a/b/c.md#h', 'CHANGELOG.md', './a.md', '../a.md', '/abs/a.md', '#heading'])(
    'allows the path %s whatever tiptap says',
    (href) => {
      expect(isAllowedLinkHref(href, tiptapRefuses)).toBe(true)
    },
  )

  it.each(['javascript:alert(1)', 'java\nscript:alert(1)', ' data:text/html,x', 'https://example.com'])(
    'leaves %j, which has a scheme, to tiptap',
    (href) => {
      expect(isAllowedLinkHref(href, tiptapRefuses)).toBe(false)
      expect(isAllowedLinkHref(href, () => true)).toBe(true)
    },
  )
})
