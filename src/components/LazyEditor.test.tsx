import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { EditorProps } from './Editor'
import { LazyEditor } from './LazyEditor'

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
    render(<LazyEditor {...({} as EditorProps)} />)

    expect(screen.getByTestId('editor-module-loading')).toBeInTheDocument()

    await act(async () => { editorModule.resolve() })
    expect(await screen.findByText('Loaded editor')).toBeInTheDocument()
  })
})
