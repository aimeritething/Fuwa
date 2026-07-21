import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { EditorProps } from './Editor'
import { LazyEditor } from './LazyEditor'

const startup = vi.hoisted(() => {
  let resolveInteractive!: () => void
  const interactive = new Promise<void>((resolve) => { resolveInteractive = resolve })
  return {
    markStartupPhase: vi.fn(),
    resolveInteractive,
    waitForStartupPhase: vi.fn(() => interactive),
  }
})

vi.mock('../lib/startupPerformance', () => startup)

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
    expect(startup.waitForStartupPhase).toHaveBeenCalledWith('react_shell')
    expect(startup.markStartupPhase).not.toHaveBeenCalledWith('editor_module_requested')

    await act(async () => { startup.resolveInteractive() })
    expect(startup.markStartupPhase).toHaveBeenCalledWith('editor_module_requested')

    rerender(<LazyEditor {...({ activeTabPath: '/vault/note.md' } as EditorProps)} />)

    await act(async () => { editorModule.resolve() })
    expect(await screen.findByText('Loaded editor')).toBeInTheDocument()
    expect(startup.markStartupPhase).toHaveBeenCalledWith('editor_module_loaded')
    expect(startup.markStartupPhase).toHaveBeenCalledWith('editor_committed')
  })
})
