import { useBlockNoteEditor, useEditorState } from '@blocknote/react'
import type { BlockSchema, InlineContentSchema, StyleSchema } from '@blocknote/core'
import {
  Code,
  Highlighter,
  TextB,
  TextItalic,
  TextStrikethrough,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import { useCallback } from 'react'
import { cn } from '@/lib/cn'
import { translate, type AppLocale } from '@/lib/i18n'
import { MARKDOWN_HIGHLIGHT_STYLE } from '@/kernel/markdown/markdown-highlight-markdown'
import { Toggle } from '@/ui/toggle'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import { getSelectedBlocksSafely, type FormattingToolbarEditor } from './formatting-toolbar-selection'

// The five text style toggles of the formatting toolbar: bold, italic,
// strikethrough, inline code and the Markdown highlight. Each is a ui/Toggle
// pressed while the style is active at the selection.

export type TextStyle =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | typeof MARKDOWN_HIGHLIGHT_STYLE

type TextStyleCopy = { label: string; mainTooltip: string; secondaryTooltip: string }

const TEXT_STYLE_COPY: Record<Exclude<TextStyle, typeof MARKDOWN_HIGHLIGHT_STYLE>, TextStyleCopy> = {
  bold: {
    label: 'Bold',
    mainTooltip: 'Bold (persists in markdown)',
    secondaryTooltip: '**strong**',
  },
  italic: {
    label: 'Italic',
    mainTooltip: 'Italic (persists in markdown)',
    secondaryTooltip: '*emphasis*',
  },
  strike: {
    label: 'Strikethrough',
    mainTooltip: 'Strikethrough (persists in markdown)',
    secondaryTooltip: '~~strike~~',
  },
  code: {
    label: 'Inline code',
    mainTooltip: 'Inline code (persists in markdown)',
    secondaryTooltip: '`code`',
  },
}

const TEXT_STYLE_ICONS: Record<TextStyle, PhosphorIcon> = {
  bold: TextB,
  italic: TextItalic,
  strike: TextStrikethrough,
  code: Code,
  [MARKDOWN_HIGHLIGHT_STYLE]: Highlighter,
}

function textStyleCopy(textStyle: TextStyle, locale: AppLocale): TextStyleCopy {
  if (textStyle === MARKDOWN_HIGHLIGHT_STYLE) {
    return {
      label: translate(locale, 'editor.formatting.highlight'),
      mainTooltip: translate(locale, 'editor.formatting.highlightTooltip'),
      secondaryTooltip: '==highlight==',
    }
  }

  return TEXT_STYLE_COPY[textStyle]
}

function editorSupportsTextStyle(textStyle: TextStyle, editor: FormattingToolbarEditor) {
  const styleSchema = Reflect.get(editor.schema.styleSchema, textStyle) as {
    type?: string
    propSchema?: unknown
  } | undefined
  return (
    textStyle in editor.schema.styleSchema &&
    styleSchema?.type === textStyle &&
    styleSchema.propSchema === 'boolean'
  )
}

function selectionSupportsInlineFormatting(editor: FormattingToolbarEditor) {
  return getSelectedBlocksSafely(editor).some((block) => block.content !== undefined)
}

function getTextStyleToggleState(textStyle: TextStyle, editor: FormattingToolbarEditor) {
  if (!editor.isEditable) return undefined
  if (!editorSupportsTextStyle(textStyle, editor)) return undefined
  if (!selectionSupportsInlineFormatting(editor)) return undefined

  return {
    active: textStyle in editor.getActiveStyles(),
  }
}

export function TextStyleToggle({
  locale = 'en',
  textStyle,
}: {
  locale?: AppLocale
  textStyle: TextStyle
}) {
  const editor = useBlockNoteEditor<BlockSchema, InlineContentSchema, StyleSchema>()
  const toggleState = useEditorState({
    editor,
    selector: ({ editor }) => getTextStyleToggleState(textStyle, editor),
  })

  const toggleStyle = useCallback(() => {
    editor.focus()
    editor.toggleStyles({ [textStyle]: true } as never)
  }, [editor, textStyle])

  if (toggleState === undefined) return null

  const Icon = TEXT_STYLE_ICONS[textStyle]
  const copy = textStyleCopy(textStyle, locale)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle
          aria-label={copy.label}
          // The highlight toggle leaves room for its colour trigger (markdown-highlight-toolbar-control.tsx).
          className={cn(textStyle === MARKDOWN_HIGHLIGHT_STYLE && 'me-3.5')}
          // Restated: the tooltip trigger writes its own open / closed data-state over the toggle's.
          data-state={toggleState.active ? 'on' : 'off'}
          data-test={textStyle}
          onClick={toggleStyle}
          pressed={toggleState.active}
        >
          <Icon aria-hidden="true" />
        </Toggle>
      </TooltipTrigger>
      <TooltipContent className="flex flex-col items-center whitespace-pre-wrap">
        <span>{copy.mainTooltip}</span>
        <span>{copy.secondaryTooltip}</span>
      </TooltipContent>
    </Tooltip>
  )
}
