import { act, render, screen, waitFor } from '@testing-library/react'
import type { EditorView } from '@codemirror/view'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { RawEditorView } from './RawEditorView'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

type CodeMirrorHost = HTMLElement & { __cmView?: EditorView }

function pasteEvent(data: Record<string, string>): Event {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: {
      getData: (type: string) => data[type] ?? '',
      types: Object.keys(data),
    },
  })
  return event
}

describe('RawEditorView remote image paste', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
    vi.mocked(invoke).mockResolvedValue('/vault/attachments/123-photo.png')
  })

  it('keeps paste immediate and rewrites the inserted remote image after import', async () => {
    const onImageImportResult = vi.fn()
    render(<RawEditorView
      content=""
      entries={[]}
      onContentChange={vi.fn()}
      onImageImportResult={onImageImportResult}
      onSave={vi.fn()}
      path="/vault/note.md"
      vaultPath="/vault"
    />)
    const host = screen.getByTestId('raw-editor-codemirror') as CodeMirrorHost
    const view = host.__cmView!
    const content = host.querySelector('.cm-content')!

    act(() => {
      content.dispatchEvent(pasteEvent({
        'text/html': '<p>Intro</p><img src="https://cdn.example.com/photo.png" alt="Photo">',
        'text/plain': 'Intro',
      }))
    })

    expect(view.state.doc.toString()).toBe('Intro\n\n![Photo](https://cdn.example.com/photo.png)')
    await waitFor(() => {
      expect(view.state.doc.toString()).toBe('Intro\n\n![Photo](attachments/123-photo.png)')
    })
    expect(onImageImportResult).toHaveBeenCalledWith({ failedCount: 0, totalCount: 1 })
    expect(view.hasFocus).toBe(true)
  })

  it('leaves failed references remote and reports a non-destructive failure', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('blocked'))
    const onImageImportResult = vi.fn()
    render(<RawEditorView
      content=""
      entries={[]}
      onContentChange={vi.fn()}
      onImageImportResult={onImageImportResult}
      onSave={vi.fn()}
      path="/vault/note.md"
      vaultPath="/vault"
    />)
    const host = screen.getByTestId('raw-editor-codemirror') as CodeMirrorHost
    const view = host.__cmView!

    act(() => {
      host.querySelector('.cm-content')!.dispatchEvent(pasteEvent({
        'text/plain': '![Photo](https://cdn.example.com/photo.png)',
      }))
    })

    await waitFor(() => {
      expect(onImageImportResult).toHaveBeenCalledWith({ failedCount: 1, totalCount: 1 })
    })
    expect(view.state.doc.toString()).toBe('![Photo](https://cdn.example.com/photo.png)')
  })
})
