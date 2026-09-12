import { describe, expect, it } from 'vitest'
import {
  BLOCK_CLIPBOARD_MIME,
  blocksWithoutIds,
  parseClipboardBlocks,
  writeSelectedBlocksToClipboard,
} from './richEditorBlockSelectionClipboard'
import type { ClipboardDataLike, RichEditorBlockSelectionEditor } from './richEditorBlockSelectionTypes'

class TestClipboardData implements ClipboardDataLike {
  private readonly data = new Map<string, string>()

  clearData() {
    this.data.clear()
  }

  getData(type: string) {
    return this.data.get(type) ?? ''
  }

  setData(type: string, value: string) {
    this.data.set(type, value)
  }
}

function parserEditor(): RichEditorBlockSelectionEditor {
  return {
    tryParseHTMLToBlocks: () => [{ id: 'html', type: 'paragraph' }],
    tryParseMarkdownToBlocks: () => [{ id: 'markdown', type: 'paragraph' }],
  }
}

function clipboardWithBlockNoteHTML(blockData: string): TestClipboardData {
  const clipboardData = new TestClipboardData()
  clipboardData.setData(BLOCK_CLIPBOARD_MIME, blockData)
  clipboardData.setData('blocknote/html', '<p>HTML</p>')
  return clipboardData
}

describe('rich editor block-selection clipboard helpers', () => {
  it('writes block JSON, rich HTML, external HTML, and markdown formats', () => {
    const clipboardData = new TestClipboardData()
    const editor: RichEditorBlockSelectionEditor = {
      document: [
        { id: 'one', content: 'One', type: 'paragraph' },
        { id: 'two', content: 'Two', type: 'paragraph' },
      ],
      blocksToFullHTML: () => '<div data-content-type="paragraph">Two</div>',
      blocksToHTMLLossy: () => '<p>Two</p>',
      blocksToMarkdownLossy: () => 'Two',
    }

    expect(writeSelectedBlocksToClipboard(editor, clipboardData, ['two'])).toBe(true)
    expect(clipboardData.getData(BLOCK_CLIPBOARD_MIME)).toContain('"id":"two"')
    expect(clipboardData.getData('blocknote/html')).toContain('data-content-type')
    expect(clipboardData.getData('text/html')).toBe('<p>Two</p>')
    expect(clipboardData.getData('text/plain')).toBe('Two')
  })

  it('parses block JSON before falling back to HTML or markdown', () => {
    const clipboardData = clipboardWithBlockNoteHTML(JSON.stringify([{ id: 'block-one', type: 'paragraph' }]))

    expect(parseClipboardBlocks(parserEditor(), clipboardData)).toEqual([{ id: 'block-one', type: 'paragraph' }])
  })

  it('falls back from invalid block JSON to BlockNote HTML', () => {
    const clipboardData = clipboardWithBlockNoteHTML('{')

    expect(parseClipboardBlocks(parserEditor(), clipboardData)).toEqual([{ id: 'html', type: 'paragraph' }])
  })

  it('strips ids from pasted blocks recursively', () => {
    expect(blocksWithoutIds([
      {
        id: 'parent',
        type: 'bulletListItem',
        children: [{ id: 'child', type: 'bulletListItem' }],
      },
    ])).toEqual([
      {
        type: 'bulletListItem',
        children: [{ type: 'bulletListItem' }],
      },
    ])
  })
})
