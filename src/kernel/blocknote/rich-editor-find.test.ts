import { Schema, type Node as ProsemirrorNode } from '@tiptap/pm/model'
import { EditorState } from '@tiptap/pm/state'
import { describe, expect, it } from 'vitest'
import {
  collectRichFindMatches,
  createRichEditorFindPlugin,
  richFindDecorations,
  richFindPluginKey,
  setRichFindState,
} from './rich-editor-find'

// A schema small enough to reason about: paragraphs of text with an inline
// leaf (an image), which is what a Document's inline content looks like to
// the matcher. Positions: the first paragraph opens at 0, its text starts at 1.
const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block', toDOM: () => ['p', 0] },
    text: { group: 'inline' },
    image: { group: 'inline', inline: true, attrs: { src: { default: '' } }, toDOM: () => ['img'] },
  },
  marks: { strong: { toDOM: () => ['strong', 0] } },
})

const paragraph = (...content: ProsemirrorNode[]) => schema.node('paragraph', null, content)
const text = (value: string) => schema.text(value)
const strong = (value: string) => schema.text(value, [schema.mark('strong')])

// Paragraph 1: "Welcome to Plumo. Welcome back." (31 chars, positions 1..32, node 0..33).
// Paragraph 2 opens at 33; "A picture " 34..44, the image at 44, " and welcome." from 45.
const doc = schema.node('doc', null, [
  paragraph(text('Welcome to '), strong('Plumo'), text('. Welcome back.')),
  paragraph(text('A picture '), schema.node('image'), text(' and welcome.')),
])

const CASE_INSENSITIVE = { caseSensitive: false, regex: false }

describe('collectRichFindMatches', () => {
  it('finds every occurrence across marks and blocks, as document positions', () => {
    const { matches, error } = collectRichFindMatches(doc, 'welcome', CASE_INSENSITIVE)
    expect(error).toBeNull()
    expect(matches).toEqual([{ from: 1, to: 8 }, { from: 19, to: 26 }, { from: 50, to: 57 }])
    for (const match of matches) expect(doc.textBetween(match.from, match.to).toLowerCase()).toBe('welcome')
  })

  it('matches text that spans a mark boundary', () => {
    const { matches } = collectRichFindMatches(doc, 'to Plumo.', CASE_INSENSITIVE)
    expect(matches).toEqual([{ from: 9, to: 18 }])
    expect(doc.textBetween(9, 18)).toBe('to Plumo.')
  })

  it('never matches across an inline leaf or across blocks', () => {
    expect(collectRichFindMatches(doc, 'picture  and', CASE_INSENSITIVE).matches).toEqual([])
    expect(collectRichFindMatches(doc, 'back.A picture', CASE_INSENSITIVE).matches).toEqual([])
  })

  it('honours case sensitivity and regex, and reports a bad regex', () => {
    expect(collectRichFindMatches(doc, 'welcome', { caseSensitive: true, regex: false }).matches).toEqual([{ from: 50, to: 57 }])
    expect(collectRichFindMatches(doc, 'w.lcome', { caseSensitive: false, regex: true }).matches).toHaveLength(3)
    expect(collectRichFindMatches(doc, '(', { caseSensitive: false, regex: true })).toMatchObject({ error: 'Invalid regex', matches: [] })
  })

  it('finds nothing for an empty query', () => {
    expect(collectRichFindMatches(doc, '', CASE_INSENSITIVE)).toEqual({ error: null, matches: [] })
  })
})

describe('the find plugin', () => {
  it('decorates every match, the active one distinctly, and follows edits to the document', () => {
    const plugin = createRichEditorFindPlugin()
    let state = EditorState.create({ doc, plugins: [plugin] })
    expect(richFindDecorations(state).find()).toEqual([])

    state = state.apply(setRichFindState(state.tr, { query: 'welcome', options: CASE_INSENSITIVE, activeIndex: 1 }))
    const decorations = richFindDecorations(state).find()
    expect(decorations.map((decoration) => [decoration.from, decoration.to])).toEqual([[1, 8], [19, 26], [50, 57]])
    expect(decorations.map((decoration) => decoration.spec.active)).toEqual([false, true, false])

    // Typing before the first match moves every match along.
    state = state.apply(state.tr.insertText('Hi. ', 1))
    expect(richFindDecorations(state).find().map((decoration) => [decoration.from, decoration.to])).toEqual([[5, 12], [23, 30], [54, 61]])
    expect(richFindPluginKey.getState(state)?.matches).toHaveLength(3)

    // Clearing the query clears the decorations.
    state = state.apply(setRichFindState(state.tr, { query: '', options: CASE_INSENSITIVE, activeIndex: 0 }))
    expect(richFindDecorations(state).find()).toEqual([])
  })
})
