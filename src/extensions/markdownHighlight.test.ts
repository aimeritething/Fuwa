import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdownLanguage } from './markdownHighlight'

function createView(doc: string) {
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  const state = EditorState.create({
    doc,
    extensions: [markdownLanguage()],
  })
  const view = new EditorView({ state, parent })
  return { view, parent }
}

describe('markdownLanguage', () => {
  it('returns a valid extension', () => {
    const ext = markdownLanguage()
    expect(ext).toBeDefined()
    expect(Array.isArray(ext)).toBe(true)
  })

  it('creates an editor without errors', () => {
    const { view, parent } = createView('# Heading\n\n**bold** and *italic*\n\n- list item')
    expect(view.state.doc.toString()).toContain('# Heading')
    view.destroy()
    parent.remove()
  })

  it('parses markdown content with mixed syntax', () => {
    const doc = [
      '# Title',
      '',
      'Some **bold** and *italic* text.',
      '',
      '- item one',
      '- item two',
      '',
      '[a link](http://example.com)',
      '',
      '> a blockquote',
      '',
      '`inline code`',
    ].join('\n')
    const { view, parent } = createView(doc)
    expect(view.state.doc.lines).toBe(12)
    view.destroy()
    parent.remove()
  })
})
