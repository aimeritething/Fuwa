import { CaretDown } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { translate } from '@/lib/i18n'
import {
  DEFAULT_MARKDOWN_HIGHLIGHT_COLOR,
  markdownHighlightColorFromStyles,
} from '@/kernel/markdown/markdown-highlight-markdown'
import { MarkdownHighlightColorMenu } from './markdown-highlight-color-menu'
import {
  useDocumentLocale,
  useEditorRevision,
  useToolbarControlState,
} from './markdown-highlight-control-state'
import {
  toggleDefaultMarkdownHighlight,
  type HighlightEditor,
} from './markdown-highlight-model'
import { selectionOrHighlightRange } from './markdown-highlight-range'
import { Button } from '@/ui/button'

export function ToolbarHighlightColorControl({
  container,
  editor,
}: {
  container: Element
  editor: HighlightEditor
}) {
  const [open, setOpen] = useState(false)
  useEditorRevision(editor)
  const control = useToolbarControlState(container)
  const locale = useDocumentLocale()
  const range = selectionOrHighlightRange(editor)
  const currentColor = markdownHighlightColorFromStyles(editor.getActiveStyles())
    ?? DEFAULT_MARKDOWN_HIGHLIGHT_COLOR
  const label = translate(locale, 'editor.formatting.highlightColor')

  useEffect(() => {
    const button = control?.button
    if (!button) return

    const toggleDefault = (event: Event) => {
      event.preventDefault()
      event.stopImmediatePropagation()
      toggleDefaultMarkdownHighlight(editor)
    }
    button.addEventListener('click', toggleDefault, true)
    return () => {
      button.removeEventListener('click', toggleDefault, true)
    }
  }, [control?.button, editor])

  if (!control) return null

  return (
    <div
      className="fixed z-popover"
      style={{ left: control.left, top: control.top }}
    >
      <MarkdownHighlightColorMenu
        currentColor={currentColor}
        editor={editor}
        onOpenChange={setOpen}
        open={open}
        range={range}
        source="toolbar"
        trigger={(
          <Button
            aria-label={label}
            className="w-4.5 min-w-4.5 rounded-none rounded-e-sm p-0 text-text-primary"
            data-test="highlightColorMenu"
            onClick={() => setOpen(current => !current)}
            onPointerDown={event => event.preventDefault()}
            size="icon-xs"
            title={label}
            variant="ghost"
          >
            <CaretDown aria-hidden="true" className="size-3" />
          </Button>
        )}
      />
    </div>
  )
}
