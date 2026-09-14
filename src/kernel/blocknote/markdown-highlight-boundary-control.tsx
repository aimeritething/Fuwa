import { Highlighter } from '@phosphor-icons/react'
import { translate } from '@/lib/i18n'
import { MarkdownHighlightColorMenu } from './markdown-highlight-color-menu'
import {
  useCursorControlState,
  useDocumentLocale,
} from './markdown-highlight-control-state'
import type { HighlightEditor } from './markdown-highlight-model'
import { Button } from '@/ui/button'

export function HighlightBoundaryColorControl({ editor }: { editor: HighlightEditor }) {
  const locale = useDocumentLocale()
  const state = useCursorControlState(editor)
  if (!state || !editor.isEditable) return null

  const label = translate(locale, 'editor.formatting.highlightChangeColor')

  return (
    <div
      className="markdown-highlight-boundary-control"
      style={{ left: state.left, top: state.top }}
    >
      <MarkdownHighlightColorMenu
        currentColor={state.color}
        editor={editor}
        range={state}
        source="cursor"
        trigger={(
          <Button
            aria-label={label}
            className="markdown-highlight-boundary-trigger"
            data-test="highlightBoundaryColorMenu"
            onMouseDown={event => event.preventDefault()}
            size="icon-xs"
            title={label}
            variant="ghost"
          >
            <Highlighter aria-hidden="true" />
          </Button>
        )}
      />
    </div>
  )
}
