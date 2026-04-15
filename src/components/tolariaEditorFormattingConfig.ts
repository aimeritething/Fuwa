import { filterSuggestionItems } from '@blocknote/core/extensions'
import {
  getDefaultReactSlashMenuItems,
  type DefaultReactSuggestionItem,
} from '@blocknote/react'
import type { ReactElement } from 'react'

type TolariaSlashMenuItem = DefaultReactSuggestionItem & { key: string }

const UNSUPPORTED_FORMATTING_TOOLBAR_KEYS = new Set([
  'blockTypeSelect',
  'underlineStyleButton',
  'textAlignLeftButton',
  'textAlignCenterButton',
  'textAlignRightButton',
  'colorStyleButton',
])

const UNSUPPORTED_SLASH_MENU_KEYS = new Set([
  'toggle_heading',
  'toggle_heading_2',
  'toggle_heading_3',
  'toggle_list',
])

export function filterTolariaFormattingToolbarItems<T extends ReactElement>(
  items: T[],
): T[] {
  return items.filter(
    (item) => !UNSUPPORTED_FORMATTING_TOOLBAR_KEYS.has(String(item.key)),
  )
}

export function filterTolariaSlashMenuItems<T extends TolariaSlashMenuItem>(
  items: T[],
): T[] {
  return items.filter((item) => !UNSUPPORTED_SLASH_MENU_KEYS.has(item.key))
}

export function getTolariaSlashMenuItems(
  editor: Parameters<typeof getDefaultReactSlashMenuItems>[0],
  query: string,
) {
  return filterSuggestionItems(
    filterTolariaSlashMenuItems(
      getDefaultReactSlashMenuItems(editor) as TolariaSlashMenuItem[],
    ),
    query,
  )
}
