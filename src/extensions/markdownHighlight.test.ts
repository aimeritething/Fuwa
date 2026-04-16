import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { forceParsing, syntaxTree } from '@codemirror/language'
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

function nodeNamesAt(view: EditorView, doc: string, needle: string) {
  const pos = doc.indexOf(needle)
  expect(pos).toBeGreaterThanOrEqual(0)
  forceParsing(view, view.state.doc.length)

  const names: string[] = []
  let node = syntaxTree(view.state).resolveInner(pos + 1, 1)
  while (node) {
    names.push(node.name)
    node = node.parent
  }
  return names
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

  it('parses valid leading frontmatter as YAML instead of markdown', () => {
    const doc = [
      '---',
      '# comment',
      'title: Hello',
      'tags:',
      '  - one',
      '"Belongs to": Alpha',
      '---',
      '',
      '# Heading',
    ].join('\n')
    const { view, parent } = createView(doc)

    expect(nodeNamesAt(view, doc, '# comment')).toContain('Frontmatter')
    expect(nodeNamesAt(view, doc, '# comment')).not.toContain('ATXHeading1')
    expect(nodeNamesAt(view, doc, '- one')).toContain('Frontmatter')
    expect(nodeNamesAt(view, doc, '- one')).not.toContain('BulletList')
    expect(nodeNamesAt(view, doc, '"Belongs to"')).toContain('Frontmatter')
    expect(nodeNamesAt(view, doc, '# Heading')).toContain('ATXHeading1')
    expect(nodeNamesAt(view, doc, '# Heading')).not.toContain('Frontmatter')

    view.destroy()
    parent.remove()
  })
})
