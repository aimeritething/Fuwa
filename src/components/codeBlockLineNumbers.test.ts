import { Schema } from '@tiptap/pm/model'
import { EditorState } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'
import { describe, expect, it } from 'vitest'
import { createCodeBlockLineNumberPlugin } from './codeBlockLineNumbers'

const schema = new Schema({
  nodes: {
    doc: { content: 'codeBlock+' },
    text: { group: 'inline' },
    codeBlock: {
      code: true,
      content: 'text*',
      toDOM: () => ['pre', ['code', 0]],
    },
  },
})

function renderCodeBlock(source: string) {
  const host = document.createElement('div')
  const content = source ? schema.text(source) : undefined
  const doc = schema.node('doc', null, [schema.node('codeBlock', null, content)])
  const state = EditorState.create({
    doc,
    plugins: [createCodeBlockLineNumberPlugin()],
  })
  const view = new EditorView(host, { state })
  return { host, view }
}

describe('code block line numbers', () => {
  it('renders an in-flow marker at every logical line start without changing source text', () => {
    const source = 'one\ntwo\n\nthree\n'
    const { host, view } = renderCodeBlock(source)

    const markers = host.querySelectorAll<HTMLElement>('[data-code-line-number]')
    expect(Array.from(markers, (marker) => marker.dataset.codeLineNumber)).toEqual([
      '1', '2', '3', '4', '5',
    ])
    expect(Array.from(markers, (marker) => marker.getAttribute('contenteditable')))
      .toEqual(['false', 'false', 'false', 'false', 'false'])
    expect(host.querySelector('code')?.textContent).toBe(source)

    view.destroy()
  })

  it('updates markers through editor transactions instead of observing rendered geometry', () => {
    const { host, view } = renderCodeBlock('one')
    const codeBlockStart = 1

    view.dispatch(view.state.tr.insertText('\ntwo\nthree', codeBlockStart + 3))

    expect(Array.from(
      host.querySelectorAll<HTMLElement>('[data-code-line-number]'),
      (marker) => marker.dataset.codeLineNumber,
    )).toEqual(['1', '2', '3'])
    expect(host.querySelector('code')?.textContent).toBe('one\ntwo\nthree')

    view.destroy()
  })
})
