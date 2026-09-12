import { createExtension } from '@blocknote/core'
import type { Node as ProsemirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { clampEditorFindIndex, findEditorMatches, type EditorFindOptions } from '../utils/editorFind'

/**
 * Find in the current Document, Rich mode (⌘F works in both modes). Raw
 * mode has Tolaria's CodeMirror find bar; Rich mode has nothing
 * carried, so this is new Fuwa code: the matcher walks the ProseMirror
 * document one textblock at a time and a plugin decorates the matches. The
 * query semantics (case, regex, the safe-regex guard) are the Raw bar's, from
 * `editorFind`, so both surfaces read a query the same way.
 */

export interface RichFindMatch {
  from: number
  to: number
}

export interface RichFindQuery {
  query: string
  options: EditorFindOptions
  /** Which match is the current one; clamped to the matches that exist. */
  activeIndex: number
}

export interface RichFindPluginState extends RichFindQuery {
  matches: RichFindMatch[]
  error: string | null
  decorations: DecorationSet
}

export interface RichFindResult {
  matches: RichFindMatch[]
  error: string | null
}

export const richFindPluginKey = new PluginKey<RichFindPluginState>('fuwaRichEditorFind')

export const RICH_FIND_MATCH_CLASS = 'fuwa-rich-find-match'
export const RICH_FIND_ACTIVE_MATCH_CLASS = 'fuwa-rich-find-match--active'

/**
 * Stands in for an inline node that is not text (an image, an inline math
 * node), one placeholder per position it occupies, so string offsets in a
 * textblock stay equal to document offsets and no query can match through it.
 */
const INLINE_LEAF_PLACEHOLDER = '￼'

const NO_QUERY: RichFindQuery = { query: '', options: { caseSensitive: false, regex: false }, activeIndex: 0 }

function textblockText(node: ProsemirrorNode): string {
  let text = ''
  node.forEach((child) => {
    text += child.isText ? child.text ?? '' : INLINE_LEAF_PLACEHOLDER.repeat(child.nodeSize)
  })
  return text
}

/** Every match of `query` in the document's textblocks, in document order, as positions. */
export function collectRichFindMatches(doc: ProsemirrorNode, query: string, options: EditorFindOptions): RichFindResult {
  if (query.length === 0) return { matches: [], error: null }
  const matches: RichFindMatch[] = []
  let error: string | null = null
  doc.descendants((node, pos) => {
    if (error !== null) return false
    if (!node.isTextblock) return true
    const result = findEditorMatches(textblockText(node), query, options)
    if (result.error) {
      error = result.error
      return false
    }
    // Positions inside a textblock are its opening position plus one, plus the offset.
    const contentStart = pos + 1
    for (const match of result.matches) {
      if (match.text.includes(INLINE_LEAF_PLACEHOLDER)) continue
      matches.push({ from: contentStart + match.from, to: contentStart + match.to })
    }
    return false
  })
  return error === null ? { matches, error: null } : { matches: [], error }
}

function decorate(doc: ProsemirrorNode, matches: readonly RichFindMatch[], activeIndex: number): DecorationSet {
  if (matches.length === 0) return DecorationSet.empty
  return DecorationSet.create(doc, matches.map((match, index) => {
    const active = index === activeIndex
    const className = active ? `${RICH_FIND_MATCH_CLASS} ${RICH_FIND_ACTIVE_MATCH_CLASS}` : RICH_FIND_MATCH_CLASS
    return Decoration.inline(match.from, match.to, { class: className }, { active })
  }))
}

function computeState(doc: ProsemirrorNode, request: RichFindQuery): RichFindPluginState {
  const { matches, error } = collectRichFindMatches(doc, request.query, request.options)
  const activeIndex = clampEditorFindIndex(request.activeIndex, matches.length)
  return { ...request, activeIndex, matches, error, decorations: decorate(doc, matches, activeIndex) }
}

const EMPTY_STATE: RichFindPluginState = { ...NO_QUERY, matches: [], error: null, decorations: DecorationSet.empty }

/** Ask the plugin to search for `request`; an empty query clears the highlights. */
export function setRichFindState(tr: Transaction, request: RichFindQuery): Transaction {
  return tr.setMeta(richFindPluginKey, request)
}

export function richFindDecorations(state: EditorState): DecorationSet {
  return richFindPluginKey.getState(state)?.decorations ?? DecorationSet.empty
}

/**
 * The plugin: recomputes on every request and on every edit while a query is
 * live, so the highlights follow the text rather than drifting with it.
 */
export function createRichEditorFindPlugin(): Plugin<RichFindPluginState> {
  return new Plugin<RichFindPluginState>({
    key: richFindPluginKey,
    state: {
      init: () => EMPTY_STATE,
      apply(tr, previous) {
        const request = tr.getMeta(richFindPluginKey) as RichFindQuery | undefined
        if (request) return request.query.length === 0 ? EMPTY_STATE : computeState(tr.doc, request)
        if (tr.docChanged && previous.query.length > 0) return computeState(tr.doc, previous)
        return previous
      },
    },
    props: {
      decorations: (state) => richFindDecorations(state),
    },
  })
}

/** The BlockNote extension that mounts the plugin into the Rich editor. */
export const createRichEditorFindExtension = createExtension(() => ({
  key: 'fuwaRichEditorFind',
  prosemirrorPlugins: [createRichEditorFindPlugin()],
}))
