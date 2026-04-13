/* eslint-disable react-refresh/only-export-components -- module-level schema, not a component file */
import { createCodeBlockSpec, BlockNoteSchema, defaultInlineContentSpecs } from '@blocknote/core'
import { codeBlockOptions } from '@blocknote/code-block'
import { createReactInlineContentSpec } from '@blocknote/react'
import { resolveWikilinkColor as resolveColor } from '../utils/wikilinkColors'
import { resolveEntry } from '../utils/wikilink'
import type { VaultEntry } from '../types'
import { NoteTitleIcon } from './NoteTitleIcon'

// Module-level cache so the WikiLink renderer (defined outside React) can access entries
export const _wikilinkEntriesRef: { current: VaultEntry[] } = { current: [] }

function resolveWikilinkColor(target: string) {
  return resolveColor(_wikilinkEntriesRef.current, target)
}

/** Resolve the display text and optional note icon for a wikilink target.
 *  Priority: pipe display text → entry title → humanised path stem */
function resolveDisplayInfo(target: string): { text: string; icon: string | null } {
  const pipeIdx = target.indexOf('|')
  if (pipeIdx !== -1) {
    const entry = resolveEntry(_wikilinkEntriesRef.current, target.slice(0, pipeIdx))
    return { text: target.slice(pipeIdx + 1), icon: entry?.icon ?? null }
  }
  const entry = resolveEntry(_wikilinkEntriesRef.current, target)
  if (entry) {
    return { text: entry.title, icon: entry.icon ?? null }
  }
  const last = target.split('/').pop() ?? target
  return { text: last.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), icon: null }
}

export const WikiLink = createReactInlineContentSpec(
  {
    type: "wikilink" as const,
    propSchema: {
      target: { default: "" },
    },
    content: "none",
  },
  {
    render: (props) => {
      const target = props.inlineContent.props.target
      const { color, isBroken } = resolveWikilinkColor(target)
      const { text, icon } = resolveDisplayInfo(target)
      return (
        <span
          className={`wikilink${isBroken ? ' wikilink--broken' : ''}`}
          data-target={target}
          style={{ color }}
        >
          <NoteTitleIcon icon={icon} size={14} className="mr-1 align-middle" />
          {text}
        </span>
      )
    },
  }
)

const codeBlock = createCodeBlockSpec({
  ...codeBlockOptions,
  defaultLanguage: 'text',
})

export const schema = BlockNoteSchema.create({
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    wikilink: WikiLink,
  },
}).extend({
  blockSpecs: {
    codeBlock,
  },
})
