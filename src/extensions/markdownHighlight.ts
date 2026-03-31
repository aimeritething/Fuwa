import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import type { Extension } from '@codemirror/state'

const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, color: '#0969da', fontWeight: '700', fontSize: '1.4em' },
  { tag: tags.heading2, color: '#0969da', fontWeight: '700', fontSize: '1.25em' },
  { tag: tags.heading3, color: '#0969da', fontWeight: '600', fontSize: '1.1em' },
  { tag: tags.heading4, color: '#0969da', fontWeight: '600' },
  { tag: tags.heading5, color: '#0969da', fontWeight: '600' },
  { tag: tags.heading6, color: '#0969da', fontWeight: '600' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: '#0969da', textDecoration: 'underline' },
  { tag: tags.url, color: '#0969da' },
  { tag: tags.monospace, color: '#c9383e', backgroundColor: 'rgba(175,184,193,0.15)', borderRadius: '3px' },
  { tag: tags.list, color: '#c9383e' },
  { tag: tags.quote, color: '#636c76', fontStyle: 'italic' },
  { tag: tags.separator, color: '#636c76' },
  { tag: tags.processingInstruction, color: '#c9383e', fontWeight: '600' },
  { tag: tags.contentSeparator, color: '#c9383e', fontWeight: '600' },
])

export function markdownLanguage(): Extension {
  return [markdown(), syntaxHighlighting(markdownHighlightStyle)]
}
