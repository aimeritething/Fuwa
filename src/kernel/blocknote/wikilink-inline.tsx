import { createReactInlineContentSpec } from '@blocknote/react'

export const WIKILINK_INLINE_CONFIG = {
  type: 'wikilink',
  propSchema: {
    target: { default: '' },
  },
  content: 'none',
} as const

/** Inert wikilink renderer: `[[target]]` / `[[target|alias]]` text round-trips losslessly
 *  through the schema, but Plumo has no wikilink UI, so it renders as plain text. */
function wikilinkDisplayText(target: string): string {
  const pipeIdx = target.indexOf('|')
  return pipeIdx === -1 ? target : target.slice(pipeIdx + 1)
}

export const WikiLinkInlineSpec = createReactInlineContentSpec(
  WIKILINK_INLINE_CONFIG,
  {
    render: (props) => {
      const target = props.inlineContent.props.target
      return (
        <span className="wikilink" data-target={target}>
          {wikilinkDisplayText(target)}
        </span>
      )
    },
  },
)
