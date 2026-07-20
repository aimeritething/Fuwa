import { describe, expect, it, vi } from 'vitest'
import {
  createRichEditorPasteHandler,
  handleRichEditorPaste,
  type RichEditorPasteContext,
} from './richEditorPaste'

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
    editor: { pasteText: vi.fn(() => true) },
    event: {
      clipboardData: clipboardDataFor(data),
    } as unknown as ClipboardEvent,
  }
}

describe('handleRichEditorPaste', () => {
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

  it('pastes immediately, then rewrites imported image blocks to local assets', async () => {
    let completeImport: ((value: {
      failedCount: number
      replacements: Map<string, string>
      totalCount: number
    }) => void) | undefined
    const importImages = vi.fn(() => new Promise(resolve => { completeImport = resolve }))
    const updateBlock = vi.fn()
    const onImportResult = vi.fn()
    const context = pasteContext({
      'text/html': '<p>Intro</p><img src="https://example.com/photo.png" alt="Photo">',
      'text/plain': 'Intro',
    })
    const editor = {
      document: [{ id: 'image-1', type: 'image', props: { url: 'https://example.com/photo.png' } }],
      pasteText: vi.fn(() => true),
      updateBlock(blockId: string, update: { props: { url: string } }) {
        expect(this).toBe(editor)
        updateBlock(blockId, update)
      },
    }
    context.editor = editor
    const handler = createRichEditorPasteHandler({
      getVaultPath: () => '/vault',
      importImages,
      onImportResult,
    })

    expect(handler(context)).toBe(true)
    expect(context.defaultPasteHandler).toHaveBeenCalledTimes(1)
    expect(updateBlock).not.toHaveBeenCalled()

    completeImport?.({
      failedCount: 0,
      replacements: new Map([['https://example.com/photo.png', 'attachments/123-photo.png']]),
      totalCount: 1,
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(updateBlock).toHaveBeenCalledWith(
      'image-1',
      { props: { url: 'asset://localhost/%2Fvault%2Fattachments%2F123-photo.png' } },
    )
    expect(onImportResult).toHaveBeenCalledWith({ failedCount: 0, totalCount: 1 })
  })

  it('leaves rich paste on the normal path when there is no active vault', () => {
    const importImages = vi.fn()
    const context = pasteContext({
      'text/html': '<img src="https://example.com/photo.png">',
      'text/plain': '',
    })
    const handler = createRichEditorPasteHandler({
      getVaultPath: () => undefined,
      importImages,
    })

    expect(handler(context)).toBe(true)
    expect(importImages).not.toHaveBeenCalled()
  })

  it('does not rewrite a different note when import finishes after navigation', async () => {
    const context = pasteContext({
      'text/html': '<img src="https://example.com/photo.png">',
    })
    context.editor = {
      document: [{ id: 'image-1', type: 'image', props: { url: 'https://example.com/photo.png' } }],
      pasteText: vi.fn(() => true),
      updateBlock: vi.fn(),
    }
    const handler = createRichEditorPasteHandler({
      canApply: () => false,
      getVaultPath: () => '/vault',
      importImages: vi.fn().mockResolvedValue({
        failedCount: 0,
        replacements: new Map([['https://example.com/photo.png', 'attachments/photo.png']]),
        totalCount: 1,
      }),
    })

    handler(context)
    await Promise.resolve()
    await Promise.resolve()

    expect(context.editor.updateBlock).not.toHaveBeenCalled()
  })
})
