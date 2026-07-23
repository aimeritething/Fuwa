import { BlockNoteEditor } from '@blocknote/core'
import { describe, expect, it } from 'vitest'
import { injectCalloutBlocks } from '../utils/calloutMarkdown'
import { serializeDurableEditorBlocks } from '../utils/editorDurableMarkdown'
import {
  injectRichEditorMarkdownBlocks,
  preProcessRichEditorMarkdown,
  serializeRichEditorBlocksToMarkdown,
} from '../utils/richEditorMarkdown'
import { schema } from './editorSchema'

async function roundTrip(markdown: string): Promise<string> {
  const editor = BlockNoteEditor.create({ schema })
  const parsed = await editor.tryParseMarkdownToBlocks(markdown)
  const injected = injectCalloutBlocks(parsed)
  editor.replaceBlocks(editor.document, injected as Parameters<typeof editor.replaceBlocks>[1])
  return serializeDurableEditorBlocks(editor, editor.document).trim()
}

describe('editor callout schema', () => {
  it('hydrates marker blockquotes as editable inline callouts', async () => {
    const editor = BlockNoteEditor.create({ schema })
    const parsed = await editor.tryParseMarkdownToBlocks([
      '> [!TIP] Read this',
      '> **bold** and [docs](https://example.com)',
    ].join('\n'))
    const [callout] = injectCalloutBlocks(parsed)

    expect(callout).toMatchObject({
      type: 'calloutBlock',
      props: { calloutType: 'tip', title: 'Read this' },
    })
    expect(JSON.stringify(callout)).toContain('bold')
    expect(JSON.stringify(callout)).toContain('https://example.com')
  })

  it('hydrates an untitled note callout for the localized fallback heading', async () => {
    const editor = BlockNoteEditor.create({ schema })
    const parsed = await editor.tryParseMarkdownToBlocks([
      '> [!note]',
      '> This untitled callout uses localized copy.',
    ].join('\n'))
    const [callout] = injectCalloutBlocks(parsed)

    expect(callout).toMatchObject({
      type: 'calloutBlock',
      props: { calloutType: 'note', title: '' },
    })
  })

  it('leaves collapsible callout variants as ordinary blockquotes', async () => {
    const markdown = [
      '> [!example]- Resources',
      '> **bold** and [docs](https://example.com)',
    ].join('\n')

    const editor = BlockNoteEditor.create({ schema })
    const parsed = await editor.tryParseMarkdownToBlocks(markdown)
    expect(injectCalloutBlocks(parsed).at(0)).toMatchObject({ type: 'quote' })
  })

  it('ignores legacy props that are absent from the current callout schema', async () => {
    const editor = BlockNoteEditor.create({ schema })
    const parsed = await editor.tryParseMarkdownToBlocks('> [!note] Legacy')
    const [callout] = injectCalloutBlocks(parsed)
    const toExternalHTML = schema.blockSpecs.calloutBlock.implementation.toExternalHTML
    const legacyCallout = {
      ...callout,
      props: {
        ...callout.props,
        fold: '-',
      },
    }

    expect(toExternalHTML).toBeTypeOf('function')
    expect(() => toExternalHTML?.(legacyCallout, editor, { nestingLevel: 0 })).not.toThrow()
  })

  it('round-trips multiline callout bodies without appending backslashes', async () => {
    const markdown = [
      '> [!note] Clean source',
      '> First line',
      '> Second line',
    ].join('\n')

    expect(await roundTrip(markdown)).toBe(markdown)
  })

  it('leaves ordinary blockquotes unchanged', async () => {
    const editor = BlockNoteEditor.create({ schema })
    const parsed = await editor.tryParseMarkdownToBlocks('> ordinary quote')
    expect(injectCalloutBlocks(parsed).at(0)).toMatchObject({ type: 'quote' })
  })

  it('round-trips durable inline syntax inside callout bodies', async () => {
    const markdown = [
      '> [!note] Durable inline content',
      '> ==highlight==, $x+1$, and [[Target]]',
    ].join('\n')
    const editor = BlockNoteEditor.create({ schema })
    const preprocessed = preProcessRichEditorMarkdown(markdown)
    const parsed = await editor.tryParseMarkdownToBlocks(preprocessed)
    const injected = injectRichEditorMarkdownBlocks(parsed)
    editor.replaceBlocks(editor.document, injected as Parameters<typeof editor.replaceBlocks>[1])

    expect(serializeRichEditorBlocksToMarkdown({
      blocks: editor.document,
      editor,
    })).toBe(`${markdown}\n`)
  })
})
