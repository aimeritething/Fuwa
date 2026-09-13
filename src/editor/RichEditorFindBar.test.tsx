import { Schema } from '@tiptap/pm/model'
import { EditorState, type Transaction } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RichEditorFindBar, type RichFindEditor } from './RichEditorFindBar'
import { createRichEditorFindPlugin, richFindDecorations } from '@/kernel/blocknote/richEditorFind'

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block', toDOM: () => ['p', 0] },
    text: { group: 'inline' },
  },
})

/** A stand-in for the BlockNote editor: a real ProseMirror state behind a view that only applies transactions. */
function fakeEditor(text: string) {
  let state = EditorState.create({
    doc: schema.node('doc', null, [schema.node('paragraph', null, [schema.text(text)])]),
    plugins: [createRichEditorFindPlugin()],
  })
  const listeners = new Set<() => void>()
  const focus = vi.fn()
  const view = {
    get state() { return state },
    isDestroyed: false,
    focus,
    dispatch(tr: Transaction) {
      state = state.apply(tr)
      if (tr.docChanged) listeners.forEach((listener) => listener())
    },
  }
  const editor: RichFindEditor = {
    prosemirrorView: view as unknown as EditorView,
    onChange: (callback) => {
      listeners.add(callback)
      return () => { listeners.delete(callback) }
    },
  }
  return {
    editor,
    focus,
    state: () => state,
    decorations: () => richFindDecorations(state).find(),
    type: (value: string) => view.dispatch(state.tr.insertText(value, 1)),
  }
}

const PATH = '/n/a.md'
const request = (id: number, path = PATH) => ({ id, path, replace: false })
const input = () => screen.getByTestId('rich-editor-find-input')
const count = () => screen.getByTestId('rich-editor-find-count')

describe('RichEditorFindBar', () => {
  it('stays closed with no request, and ignores a request for another Document', () => {
    const { editor } = fakeEditor('one')
    const view = render(<RichEditorFindBar editor={editor} path={PATH} request={null} />)
    expect(screen.queryByTestId('rich-editor-find-bar')).toBeNull()

    view.rerender(<RichEditorFindBar editor={editor} path={PATH} request={request(1, '/n/b.md')} />)
    expect(screen.queryByTestId('rich-editor-find-bar')).toBeNull()
  })

  it('opens on a request, counts and highlights the matches, and walks them with ↵ and ⇧↵', () => {
    const fake = fakeEditor('Welcome to Fuwa. Welcome back, and welcome again.')
    render(<RichEditorFindBar editor={fake.editor} path={PATH} request={request(1)} />)
    expect(count()).toHaveTextContent('No matches')

    fireEvent.change(input(), { target: { value: 'welcome' } })
    expect(count()).toHaveTextContent('1 / 3')
    expect(fake.decorations().map((decoration) => decoration.spec.active)).toEqual([true, false, false])

    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(count()).toHaveTextContent('2 / 3')
    expect(fake.decorations().map((decoration) => decoration.spec.active)).toEqual([false, true, false])
    // The editor's selection moved onto the current match.
    const { from, to } = fake.state().selection
    expect(fake.state().doc.textBetween(from, to)).toBe('Welcome')
    expect(from).toBe(18)

    fireEvent.keyDown(input(), { key: 'Enter', shiftKey: true })
    expect(count()).toHaveTextContent('1 / 3')
    fireEvent.keyDown(input(), { key: 'Enter', shiftKey: true })
    expect(count()).toHaveTextContent('3 / 3')
  })

  it('follows an edit to the Document', () => {
    const fake = fakeEditor('Welcome.')
    render(<RichEditorFindBar editor={fake.editor} path={PATH} request={request(1)} />)
    fireEvent.change(input(), { target: { value: 'welcome' } })
    expect(count()).toHaveTextContent('1 / 1')

    act(() => fake.type('Welcome, '))
    expect(count()).toHaveTextContent('1 / 2')
    expect(fake.decorations()).toHaveLength(2)
  })

  it('honours the case and regex toggles', () => {
    const fake = fakeEditor('Welcome and welcome.')
    render(<RichEditorFindBar editor={fake.editor} path={PATH} request={request(1)} />)
    fireEvent.change(input(), { target: { value: 'welcome' } })
    expect(count()).toHaveTextContent('1 / 2')

    fireEvent.click(screen.getByRole('button', { name: 'Match case' }))
    expect(count()).toHaveTextContent('1 / 1')

    fireEvent.click(screen.getByRole('button', { name: 'Use regular expression' }))
    fireEvent.change(input(), { target: { value: 'w(' } })
    expect(count()).toHaveTextContent('Invalid regex')
  })

  it('esc closes the bar, clears the highlights and hands focus back to the editor; a new request reopens it', () => {
    const fake = fakeEditor('Welcome.')
    const view = render(<RichEditorFindBar editor={fake.editor} path={PATH} request={request(1)} />)
    fireEvent.change(input(), { target: { value: 'welcome' } })
    expect(fake.decorations()).toHaveLength(1)

    fireEvent.keyDown(input(), { key: 'Escape' })
    expect(screen.queryByTestId('rich-editor-find-bar')).toBeNull()
    expect(fake.decorations()).toEqual([])
    expect(fake.focus).toHaveBeenCalled()

    view.rerender(<RichEditorFindBar editor={fake.editor} path={PATH} request={request(2)} />)
    expect(screen.getByTestId('rich-editor-find-bar')).toBeInTheDocument()
    expect(fake.decorations()).toHaveLength(1)
  })
})
