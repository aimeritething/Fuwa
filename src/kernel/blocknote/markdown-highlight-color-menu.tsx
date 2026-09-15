import { Check } from '@phosphor-icons/react'
import { cva } from 'class-variance-authority'
import type { ReactNode } from 'react'
import {
  MARKDOWN_HIGHLIGHT_COLORS,
  type MarkdownHighlightColor,
} from '@/kernel/markdown/markdown-highlight-markdown'
import { colorLabel, useDocumentLocale } from './markdown-highlight-control-state'
import {
  applyMarkdownHighlightColor,
  type HighlightControlSource,
  type HighlightEditor,
  type HighlightRange,
} from './markdown-highlight-model'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'

// The colour chip before each name: the chroma as the ring, its wash as the fill.
const swatchVariants = cva('size-3.5 shrink-0 rounded-full border border-current', {
  variants: {
    color: {
      yellow: 'bg-chroma-yellow-bg text-chroma-yellow',
      green: 'bg-chroma-green-bg text-chroma-green',
      red: 'bg-chroma-red-bg text-chroma-red',
      blue: 'bg-chroma-blue-bg text-chroma-blue',
      purple: 'bg-chroma-purple-bg text-chroma-purple',
    } satisfies Record<MarkdownHighlightColor, string>,
  },
})

interface MarkdownHighlightColorMenuProps {
  currentColor: MarkdownHighlightColor
  editor: HighlightEditor
  onOpenChange?: (open: boolean) => void
  open?: boolean
  range: HighlightRange | null
  source: HighlightControlSource
  trigger: ReactNode
}

export function MarkdownHighlightColorMenu(props: MarkdownHighlightColorMenuProps) {
  const { currentColor, editor, onOpenChange, open, range, source, trigger } = props
  const locale = useDocumentLocale()

  return (
    <DropdownMenu onOpenChange={onOpenChange} open={open}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {MARKDOWN_HIGHLIGHT_COLORS.map(color => (
          <DropdownMenuItem
            key={color}
            onSelect={() => applyMarkdownHighlightColor(editor, color, range, source)}
          >
            <span aria-hidden="true" className={swatchVariants({ color })} />
            <span>{colorLabel(locale, color)}</span>
            {currentColor === color && <Check aria-hidden="true" className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
