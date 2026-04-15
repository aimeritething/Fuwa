import {
  FormattingToolbar,
  getFormattingToolbarItems,
} from '@blocknote/react'
import { filterTolariaFormattingToolbarItems } from './tolariaEditorFormattingConfig'

export function TolariaFormattingToolbar() {
  const items = filterTolariaFormattingToolbarItems(
    getFormattingToolbarItems(),
  )

  return <FormattingToolbar>{items}</FormattingToolbar>
}
