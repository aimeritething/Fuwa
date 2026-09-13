import { describe, expect, it, vi } from 'vitest'
import {
  installRichEditorMarkdownSerializer,
  restoreBlankBlockquoteParagraphs,
  serializeRichEditorBodyToMarkdown,
  type RichEditorMarkdownSerializer,
} from './richEditorMarkdown'

describe('rich-editor Markdown serialization', () => {
  it('restores blank blockquotes without shifting the remaining document lines', () => {
    const serialized = Array.from(
      { length: 1_000 },
      (_, index) => `> Paragraph ${index}\n\n>\n\n\n> Continuation ${index}`,
    ).join('\n')
    const shiftSpy = vi.spyOn(Array.prototype, 'shift')

    let restored = ''
    let shiftCount = 0
    try {
      restored = restoreBlankBlockquoteParagraphs(serialized)
      shiftCount = shiftSpy.mock.calls.length
    } finally {
      shiftSpy.mockRestore()
    }

    expect(restored).toContain('> Paragraph 0\n>\n\n> Continuation 0')
    expect(restored).toContain('> Paragraph 999\n>\n\n> Continuation 999')
    expect(shiftCount).toBe(0)
  })

  it('installs direct serialization through the shared rich-editor API', () => {
    const blocksToMarkdownLossy = vi.fn(() => 'legacy markdown\n')
    const editor: RichEditorMarkdownSerializer = {
      document: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Keep [[Project Alpha]] fast.', styles: {} }],
        children: [],
      }],
      blocksToMarkdownLossy,
    }

    installRichEditorMarkdownSerializer(editor)

    expect(serializeRichEditorBodyToMarkdown(editor)).toBe('Keep [[Project Alpha]] fast.\n')
    expect(blocksToMarkdownLossy).not.toHaveBeenCalled()
  })
})
