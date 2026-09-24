import type { MouseEvent } from 'react'
import { X } from '@phosphor-icons/react'
import { cn } from '@/lib/cn'

interface CloseAffordanceProps {
  /** The name of the thing that closes, for the accessible label. */
  name: string
  onClose: () => void
  /** Shown only while its row is hovered (a Tab), rather than also while its row is selected (an Open Editors row). */
  hoverOnly?: boolean
  className?: string
}

/**
 * The × that closes a Tab from the tab bar or an Open Editors row. Hidden
 * until its row is hovered, or, on an Open Editors row, selected: the row is a
 * `group`, and this reads the row's hover and `aria-selected`. The click stops
 * at the button so the row underneath is not activated.
 */
export function CloseAffordance({ name, onClose, hoverOnly = false, className }: CloseAffordanceProps) {
  const close = (event: MouseEvent) => {
    event.stopPropagation()
    onClose()
  }

  return (
    <button
      type="button"
      className={cn(
        'flex size-4.5 flex-none cursor-default items-center justify-center rounded-sm border-0 bg-transparent p-0 text-text-secondary opacity-0 group-hover:opacity-100 hover:bg-control-tertiary-hover hover:text-text-heading',
        !hoverOnly && 'group-aria-selected:opacity-100',
        className,
      )}
      aria-label={`Close ${name}`}
      data-testid="tab-close"
      tabIndex={-1}
      onClick={close}
    >
      <X size={12} weight="bold" aria-hidden="true" />
    </button>
  )
}
