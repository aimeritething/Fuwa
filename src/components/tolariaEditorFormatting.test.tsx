import { describe, expect, it } from 'vitest'
import { getFormattingToolbarItems } from '@blocknote/react'
import {
  filterTolariaFormattingToolbarItems,
  filterTolariaSlashMenuItems,
} from './tolariaEditorFormattingConfig'

describe('tolariaEditorFormatting', () => {
  it('removes formatting toolbar controls that do not round-trip through markdown', () => {
    const itemKeys = filterTolariaFormattingToolbarItems(
      getFormattingToolbarItems(),
    ).map((item) => String(item.key))

    expect(itemKeys).toContain('boldStyleButton')
    expect(itemKeys).toContain('italicStyleButton')
    expect(itemKeys).toContain('strikeStyleButton')
    expect(itemKeys).toContain('createLinkButton')

    expect(itemKeys).not.toContain('blockTypeSelect')
    expect(itemKeys).not.toContain('underlineStyleButton')
    expect(itemKeys).not.toContain('colorStyleButton')
    expect(itemKeys).not.toContain('textAlignLeftButton')
    expect(itemKeys).not.toContain('textAlignCenterButton')
    expect(itemKeys).not.toContain('textAlignRightButton')
  })

  it('filters unsupported toggle slash-menu variants while keeping markdown-safe options', () => {
    type TolariaSlashMenuTestItem = {
      key: string
      title: string
      onItemClick: () => void
    }

    const items = filterTolariaSlashMenuItems([
      { key: 'toggle_heading', title: 'Toggle heading', onItemClick: () => {} },
      { key: 'toggle_list', title: 'Toggle list', onItemClick: () => {} },
      { key: 'heading', title: 'Heading', onItemClick: () => {} },
      { key: 'bullet_list', title: 'Bullet List', onItemClick: () => {} },
    ] satisfies TolariaSlashMenuTestItem[])

    expect(items.map((item) => item.key)).toEqual(['heading', 'bullet_list'])
  })
})
