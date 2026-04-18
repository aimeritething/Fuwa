import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEditorTabSwap } from './useEditorTabSwap'

function makeTab(path: string, title: string, body: string) {
  return {
    entry: { path, title, filename: `${title}.md`, type: 'Note', status: 'Active', aliases: [], isA: '' } as never,
    content: `---\ntitle: ${title}\n---\n\n# ${title}\n\n${body}`,
  }
}

function makeMockEditor(currentMarkdown: string) {
  const docRef = {
    current: [
      {
        type: 'heading',
        props: { level: 1 },
        content: [{ type: 'text', text: 'Fresh Title', styles: {} }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Body typed live', styles: {} }],
      },
    ] as unknown[],
  }

  const editor = {
    get document() { return docRef.current },
    get prosemirrorView() { return {} },
    onMount: (cb: () => void) => { cb(); return () => {} },
    replaceBlocks: vi.fn(),
    insertBlocks: vi.fn(),
    blocksToMarkdownLossy: vi.fn(() => currentMarkdown),
    blocksToHTMLLossy: vi.fn(() => ''),
    tryParseMarkdownToBlocks: vi.fn(() => []),
    _tiptapEditor: { commands: { setContent: vi.fn() } },
  }

  return editor
}

describe('useEditorTabSwap untitled rename continuity', () => {
  it('keeps the live editor session when an untitled note auto-renames', async () => {
    vi.spyOn(document, 'querySelector').mockReturnValue({ scrollTop: 0 } as unknown as Element)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0 })

    const editor = makeMockEditor('# Fresh Title\n\nBody typed live')
    const onContentChange = vi.fn()
    const untitledTab = makeTab('untitled-note-123.md', 'Untitled Note 123', 'Body')
    const renamedTab = makeTab('fresh-title.md', 'Fresh Title', 'Body')

    const { result, rerender } = renderHook(
      ({ tabs, activeTabPath }) => useEditorTabSwap({
        tabs,
        activeTabPath,
        editor: editor as never,
        onContentChange,
      }),
      { initialProps: { tabs: [untitledTab], activeTabPath: untitledTab.entry.path } },
    )

    await act(() => new Promise(r => setTimeout(r, 0)))
    editor.replaceBlocks.mockClear()
    editor.tryParseMarkdownToBlocks.mockClear()

    rerender({ tabs: [renamedTab], activeTabPath: renamedTab.entry.path })
    await act(() => new Promise(r => setTimeout(r, 0)))

    expect(editor.replaceBlocks).not.toHaveBeenCalled()
    expect(editor.tryParseMarkdownToBlocks).not.toHaveBeenCalled()

    act(() => {
      result.current.handleEditorChange()
    })

    expect(onContentChange).toHaveBeenCalledWith(
      'fresh-title.md',
      expect.stringContaining('Body typed live'),
    )
  })

  it('still swaps when the next note does not match the live untitled body', async () => {
    vi.spyOn(document, 'querySelector').mockReturnValue({ scrollTop: 0 } as unknown as Element)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0 })

    const editor = makeMockEditor('# Fresh Title\n\nBody typed live')
    const untitledTab = makeTab('untitled-note-123.md', 'Untitled Note 123', 'Body')
    const otherTab = makeTab('fresh-title.md', 'Fresh Title', 'Different body')

    const { rerender } = renderHook(
      ({ tabs, activeTabPath }) => useEditorTabSwap({
        tabs,
        activeTabPath,
        editor: editor as never,
      }),
      { initialProps: { tabs: [untitledTab], activeTabPath: untitledTab.entry.path } },
    )

    await act(() => new Promise(r => setTimeout(r, 0)))
    editor.replaceBlocks.mockClear()
    editor.tryParseMarkdownToBlocks.mockClear()

    rerender({ tabs: [otherTab], activeTabPath: otherTab.entry.path })
    await act(() => new Promise(r => setTimeout(r, 0)))

    expect(editor.tryParseMarkdownToBlocks).toHaveBeenCalled()
  })

  it('keeps the live editor session when the renamed tab arrives one render after the path switch', async () => {
    vi.spyOn(document, 'querySelector').mockReturnValue({ scrollTop: 0 } as unknown as Element)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0 })

    const editor = makeMockEditor('# Fresh Title\n\nBody typed live')
    const onContentChange = vi.fn()
    const untitledTab = makeTab('untitled-note-123.md', 'Untitled Note 123', 'Body')
    const renamedTab = makeTab('fresh-title.md', 'Fresh Title', 'Body')

    const { result, rerender } = renderHook(
      ({ tabs, activeTabPath }) => useEditorTabSwap({
        tabs,
        activeTabPath,
        editor: editor as never,
        onContentChange,
      }),
      { initialProps: { tabs: [untitledTab], activeTabPath: untitledTab.entry.path } },
    )

    await act(() => new Promise(r => setTimeout(r, 0)))
    editor.replaceBlocks.mockClear()
    editor.tryParseMarkdownToBlocks.mockClear()

    rerender({ tabs: [untitledTab], activeTabPath: renamedTab.entry.path })
    await act(() => new Promise(r => setTimeout(r, 0)))

    rerender({ tabs: [renamedTab], activeTabPath: renamedTab.entry.path })
    await act(() => new Promise(r => setTimeout(r, 0)))

    expect(editor.replaceBlocks).not.toHaveBeenCalled()
    expect(editor.tryParseMarkdownToBlocks).not.toHaveBeenCalled()

    act(() => {
      result.current.handleEditorChange()
    })

    expect(onContentChange).toHaveBeenCalledWith(
      'fresh-title.md',
      expect.stringContaining('Body typed live'),
    )
  })
})
