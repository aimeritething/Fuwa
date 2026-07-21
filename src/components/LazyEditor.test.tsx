import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { EditorProps } from './Editor'
import { LazyEditor } from './LazyEditor'

const markStartupPhase = vi.hoisted(() => vi.fn())

vi.mock('../lib/startupPerformance', () => ({ markStartupPhase }))

const editorModule = vi.hoisted(() => {
  let resolve!: () => void
  const ready = new Promise<void>((next) => { resolve = next })
  return { ready, resolve }
})

vi.mock('./Editor', async () => {
  await editorModule.ready
  return { Editor: () => <div>Loaded editor</div> }
})

describe('LazyEditor', () => {
  it('keeps the app shell renderable while the editor bundle loads', async () => {
    const { rerender } = render(<LazyEditor {...({ activeTabPath: null } as EditorProps)} />)

    expect(screen.getByTestId('editor-module-loading')).toBeInTheDocument()
    expect(markStartupPhase).not.toHaveBeenCalledWith('editor_module_requested')

    rerender(<LazyEditor {...({ activeTabPath: '/vault/note.md' } as EditorProps)} />)
    expect(markStartupPhase).toHaveBeenCalledWith('editor_module_requested')

    await act(async () => { editorModule.resolve() })
    expect(await screen.findByText('Loaded editor')).toBeInTheDocument()
    expect(markStartupPhase).toHaveBeenCalledWith('editor_module_loaded')
    expect(markStartupPhase).toHaveBeenCalledWith('editor_committed')
  })
})
