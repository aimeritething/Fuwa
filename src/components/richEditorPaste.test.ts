import { describe, expect, it, vi } from 'vitest'
import { BlockNoteEditor } from '@blocknote/core'
import {
  handleRichEditorPaste,
  type RichEditorPasteContext,
} from './richEditorPaste'
import { schema } from './editorSchema'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `asset://localhost/${encodeURIComponent(path)}`,
}))

function clipboardDataFor(data: Record<string, string>): DataTransfer {
  return {
    getData: vi.fn((type: string) => data[type] ?? ''),
    types: Object.keys(data),
  } as unknown as DataTransfer
}

function pasteContext(data: Record<string, string>): RichEditorPasteContext {
  return {
    defaultPasteHandler: vi.fn(() => true),
    editor: { pasteMarkdown: vi.fn(), pasteText: vi.fn(() => true) },
    event: {
      clipboardData: clipboardDataFor(data),
    } as unknown as ClipboardEvent,
  }
}

const angleOpen = String.fromCharCode(60)
const angleClose = String.fromCharCode(62)
const cppInclude = `#include ${angleOpen}iostream${angleClose}`
const cppSource = `${cppInclude}\nint main() { return 0; }`
const fencedCppSource = ['```', cppSource, '```'].join('\n')

function htmlTag(name: string): string {
  return `${angleOpen}${name}${angleClose}`
}

function htmlCodeBlock(markup: string): string {
  return `${htmlTag('pre')}${htmlTag('code')}${markup}${htmlTag('/code')}${htmlTag('/pre')}`
}

describe('handleRichEditorPaste', () => {
  it('leaves a pasted image to the kernel, which writes it as an Attachment', () => {
    // A screenshot on the clipboard arrives as files and nothing else; the
    // default handler is BlockNote's file branch, and `uploadFile` puts the
    // Attachment in `attachments/` beside the Document (AIM-384).
    const context = pasteContext({})
    context.event = {
      clipboardData: {
        getData: vi.fn(() => ''),
        types: ['Files'],
      },
    } as unknown as ClipboardEvent

    expect(handleRichEditorPaste(context)).toBe(true)

    expect(context.defaultPasteHandler).toHaveBeenCalledWith()
    expect(context.editor.pasteText).not.toHaveBeenCalled()
  })

  it('turns a selected label into a link when a URL is pasted', () => {
    const createLink = vi.fn()
    const context = pasteContext({
      'text/plain': 'https://example.com/docs?section=editor&mode=rich',
    })
    context.editor = {
      createLink,
      getSelectedText: vi.fn(() => 'selected label'),
      pasteText: vi.fn(() => true),
    }

    expect(handleRichEditorPaste(context)).toBe(true)

    expect(createLink).toHaveBeenCalledWith('https://example.com/docs?section=editor&mode=rich')
    expect(context.defaultPasteHandler).not.toHaveBeenCalled()
    expect(context.editor.pasteText).not.toHaveBeenCalled()
  })

  it('keeps non-URL text and internal editor clips on their normal paste paths', () => {
    const nonUrlContext = pasteContext({ 'text/plain': 'plain clipboard text' })
    nonUrlContext.editor = {
      createLink: vi.fn(),
      getSelectedText: vi.fn(() => 'selected label'),
      pasteText: vi.fn(() => true),
    }
    const internalContext = pasteContext({
      'blocknote/html': '<p>https://example.com</p>',
      'text/plain': 'https://example.com',
    })
    internalContext.editor = {
      createLink: vi.fn(),
      getSelectedText: vi.fn(() => 'selected label'),
      pasteText: vi.fn(() => true),
    }

    expect(handleRichEditorPaste(nonUrlContext)).toBe(true)
    expect(handleRichEditorPaste(internalContext)).toBe(true)

    expect(nonUrlContext.defaultPasteHandler).toHaveBeenCalledOnce()
    expect(internalContext.defaultPasteHandler).toHaveBeenCalledOnce()
    expect(nonUrlContext.editor.createLink).not.toHaveBeenCalled()
    expect(internalContext.editor.createLink).not.toHaveBeenCalled()
  })

  it('prioritizes pasted web HTML when it contains images', () => {
    const context = pasteContext({
      'text/html': '<article><p>Intro</p><img src="https://example.com/photo.png" alt="Photo"></article>',
      'text/plain': 'Intro',
    })

    expect(handleRichEditorPaste(context)).toBe(true)

    expect(context.defaultPasteHandler).toHaveBeenCalledWith({ prioritizeMarkdownOverHTML: false })
    expect(context.editor.pasteText).not.toHaveBeenCalled()
  })

  it('keeps internal BlockNote image clips on the regular paste path', () => {
    const context = pasteContext({
      'blocknote/html': '<div data-content-type="image"></div>',
      'text/html': '<img src="asset://localhost/photo.png">',
      'text/plain': '![photo](attachments/photo.png)',
    })

    expect(handleRichEditorPaste(context)).toBe(true)

    expect(context.defaultPasteHandler).toHaveBeenCalledWith()
  })

  it('keeps explicit Markdown clips containing angle brackets on the regular paste path', () => {
    const context = pasteContext({
      'text/markdown': 'Use <kbd>Enter</kbd>',
      'text/plain': 'Use <kbd>Enter</kbd>',
    })

    expect(handleRichEditorPaste(context)).toBe(true)

    expect(context.defaultPasteHandler).toHaveBeenCalledWith()
    expect(context.editor.pasteText).not.toHaveBeenCalled()
  })

  it('preserves linked inline-code Markdown pasted as plain text', () => {
    const context = pasteContext({
      'text/plain': '[`some-symbol`](https://example.com)',
    })
    const editor = BlockNoteEditor.create({ schema })
    context.editor = editor as unknown as RichEditorPasteContext['editor']

    expect(handleRichEditorPaste(context)).toBe(true)

    expect(editor.document[0].content).toEqual([{
      content: [{ styles: { code: true }, text: 'some-symbol', type: 'text' }],
      href: 'https://example.com',
      type: 'link',
    }])
    expect(context.defaultPasteHandler).not.toHaveBeenCalled()
  })

  it.each([
    {
      name: 'fenced code Markdown with angle brackets',
      data: { 'text/plain': fencedCppSource },
    },
    {
      name: 'pasted HTML code blocks',
      data: {
        'text/html': htmlCodeBlock('#include &lt;iostream&gt;\nint main() { return 0; }'),
        'text/plain': cppSource,
      },
    },
  ])('converts $name before literal text handling', ({ data }) => {
    const context = pasteContext(data)

    expect(handleRichEditorPaste(context)).toBe(true)

    expect(context.editor.pasteMarkdown).toHaveBeenCalledWith(fencedCppSource)
    expect(context.defaultPasteHandler).not.toHaveBeenCalled()
    expect(context.editor.pasteText).not.toHaveBeenCalled()
  })

  it('does not parse untrusted HTML code without a plain-text clipboard source', () => {
    const context = pasteContext({
      'text/html': htmlCodeBlock('&lt;script&gt;window.compromised = true&lt;/script&gt;'),
    })

    expect(handleRichEditorPaste(context)).toBe(true)

    expect(context.defaultPasteHandler).toHaveBeenCalledWith()
    expect(context.editor.pasteMarkdown).not.toHaveBeenCalled()
    expect(context.editor.pasteText).not.toHaveBeenCalled()
  })

  it('replaces an empty paragraph with a canonicalized pasted code block', () => {
    const cursorBlock = { id: 'empty-paragraph', type: 'paragraph', content: [] }
    const context = pasteContext({
      'text/plain': '```ts\nconst answer: number = 42\n```',
    })
    context.editor = {
      getTextCursorPosition: vi.fn(() => ({ block: cursorBlock })),
      insertBlocks: vi.fn(),
      pasteMarkdown: vi.fn(),
      pasteText: vi.fn(() => true),
      replaceBlocks: vi.fn(),
    }

    expect(handleRichEditorPaste(context)).toBe(true)

    expect(context.editor.replaceBlocks).toHaveBeenCalledWith([cursorBlock], [{
      children: [],
      content: [{ styles: {}, text: 'const answer: number = 42', type: 'text' }],
      props: { language: 'typescript' },
      type: 'codeBlock',
    }])
    expect(context.editor.insertBlocks).not.toHaveBeenCalled()
    expect(context.editor.pasteMarkdown).not.toHaveBeenCalled()
    expect(context.editor.pasteText).not.toHaveBeenCalled()
  })
})
