import { getFormattingToolbarItems } from '@blocknote/react'
import { describe, expect, it } from 'vitest'
import { filterFormattingToolbarItems } from './formatting-toolbar'

describe('filterFormattingToolbarItems', () => {
  it('keeps the markdown-safe toolbar controls and block type select', () => {
    const itemKeys = filterFormattingToolbarItems(getFormattingToolbarItems()).map((item) => String(item.key))

    expect(itemKeys).toContain('blockTypeSelect')
    expect(itemKeys).toContain('boldStyleButton')
    expect(itemKeys).toContain('italicStyleButton')
    expect(itemKeys).toContain('strikeStyleButton')
    expect(itemKeys).toContain('createLinkButton')
    expect(itemKeys).toContain('nestBlockButton')
    expect(itemKeys).toContain('unnestBlockButton')

    expect(itemKeys).not.toContain('underlineStyleButton')
    expect(itemKeys).not.toContain('colorStyleButton')
    expect(itemKeys).not.toContain('textAlignLeftButton')
    expect(itemKeys).not.toContain('textAlignCenterButton')
    expect(itemKeys).not.toContain('textAlignRightButton')
  })
})
