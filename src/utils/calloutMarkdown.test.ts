import { describe, expect, it, vi } from 'vitest'
import type { BlockLike, InlineItem } from './durableMarkdownBlocks'
import {
  buildCalloutBlock,
  calloutHeading,
  calloutStartsExpanded,
  parseCalloutMarker,
  serializeCalloutBlock,
} from './calloutMarkdown'
import { resolveCalloutDefinition } from './calloutCatalog'

function quote(content: InlineItem[]): BlockLike {
  return { type: 'quote', content }
}

describe('callout markers', () => {
  it('uses localized copy for an untitled note callout', () => {
    expect(calloutHeading('note', '', 'Nota')).toBe('Nota')
  })

  it('recognizes Obsidian and GFM alert markers case-insensitively', () => {
    expect(parseCalloutMarker('[!TIP] A useful tip')).toEqual({
      fold: '',
      title: 'A useful tip',
      type: 'tip',
    })
    expect(parseCalloutMarker('[!custom-alert]- Closed')).toEqual({
      fold: '-',
      title: 'Closed',
      type: 'custom-alert',
    })
    expect(parseCalloutMarker('[!123] Invalid')).toBeNull()
  })

  it('maps known aliases to semantic families and unknown types to note styling', () => {
    expect(resolveCalloutDefinition({ type: 'TIP' }).family).toBe('success')
    expect(resolveCalloutDefinition({ type: 'caution' }).family).toBe('warning')
    expect(resolveCalloutDefinition({ type: 'bug' }).family).toBe('error')
    expect(resolveCalloutDefinition({ type: 'custom-alert' }).family).toBe('note')
  })

  it('resolves every default Obsidian type and alias to its canonical style', () => {
    const canonicalType = (type: string) => resolveCalloutDefinition({ type }).type
    expect(canonicalType('summary')).toBe('abstract')
    expect(canonicalType('tldr')).toBe('abstract')
    expect(canonicalType('hint')).toBe('tip')
    expect(canonicalType('important')).toBe('tip')
    expect(canonicalType('check')).toBe('success')
    expect(canonicalType('done')).toBe('success')
    expect(canonicalType('help')).toBe('question')
    expect(canonicalType('faq')).toBe('question')
    expect(canonicalType('caution')).toBe('warning')
    expect(canonicalType('attention')).toBe('warning')
    expect(canonicalType('fail')).toBe('failure')
    expect(canonicalType('missing')).toBe('failure')
    expect(canonicalType('error')).toBe('danger')
    expect(canonicalType('cite')).toBe('quote')
    expect(canonicalType('custom-alert')).toBe('note')
  })

  it('uses the fold marker as the initial disclosure state', () => {
    expect(calloutStartsExpanded('-')).toBe(false)
    expect(calloutStartsExpanded('+')).toBe(true)
    expect(calloutStartsExpanded('')).toBe(true)
  })
})

describe('callout block conversion', () => {
  it('keeps rich inline body content while removing the marker line', () => {
    const link: InlineItem = {
      type: 'link',
      props: { href: 'https://example.com' },
      content: [{ type: 'text', text: 'docs', styles: { italic: true } }],
    }
    const block = buildCalloutBlock(quote([
      { type: 'text', text: '[!tip] Read this\n' },
      { type: 'text', text: 'Bold body ', styles: { bold: true } },
      link,
    ]))

    expect(block).toMatchObject({
      type: 'calloutBlock',
      props: { calloutType: 'tip', fold: '', title: 'Read this' },
      content: [
        { type: 'text', text: 'Bold body ', styles: { bold: true } },
        link,
      ],
    })
  })

  it('serializes the marker and rich body through the editor serializer', () => {
    const editor = {
      blocksToMarkdownLossy: vi.fn().mockReturnValue('**Bold body** and [docs](https://example.com)'),
    }
    const markdown = serializeCalloutBlock(editor, {
      type: 'calloutBlock',
      props: { calloutType: 'tip', fold: '+', title: 'Read this' },
      content: [{ type: 'text', text: 'body' }],
    })

    expect(markdown).toBe([
      '> [!tip]+ Read this',
      '> **Bold body** and [docs](https://example.com)',
    ].join('\n'))
    expect(editor.blocksToMarkdownLossy).toHaveBeenCalledWith([
      expect.objectContaining({ type: 'paragraph' }),
    ])
  })

  it('does not add hard-break backslashes to multiline callout bodies', () => {
    const editor = {
      blocksToMarkdownDirect: vi.fn().mockReturnValue({
        markdown: 'First line\nSecond line',
        metrics: {
          blockCount: 1,
          cacheHits: 0,
          cacheMisses: 1,
          durationMs: 0,
          fallbackReason: null,
        },
        supported: true,
      }),
      blocksToMarkdownLossy: vi.fn().mockReturnValue('First line\\\\\nSecond line'),
    }

    expect(serializeCalloutBlock(editor, {
      type: 'calloutBlock',
      props: { calloutType: 'note', fold: '', title: '' },
      content: [{ type: 'text', text: 'First line\nSecond line' }],
    })).toBe([
      '> [!note]',
      '> First line',
      '> Second line',
    ].join('\n'))
    expect(editor.blocksToMarkdownLossy).not.toHaveBeenCalled()
  })
})
