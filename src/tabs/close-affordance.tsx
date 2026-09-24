import type { MouseEvent } from 'react'
import { X } from '@phosphor-icons/react'
import { cn } from '@/lib/cn'

interface CloseAffordanceProps {
  /** The name of the thing that closes, for the accessible label. */
  name: string
  onClose: () => void
  className?: string
}

/**
 * The × that closes a Tab from the tab bar: out of the layout until its Tab
 * is hovered (the Tab is a `group`), then laid out after the name, so the Tab
 * grows to make room rather than covering the name. The click stops at the
 * button so the Tab underneath is not activated.
 */
export function CloseAffordance({ name, onClose, className }: CloseAffordanceProps) {
  const close = (event: MouseEvent) => {
    event.stopPropagation()
    onClose()
  }

  return (
    <button
      type="button"
      className={cn(
        'size-4.5 flex-none cursor-default items-center justify-center rounded-sm border-0 bg-transparent p-0 text-text-secondary hover:bg-control-tertiary-hover hover:text-text-heading',
        'hidden group-hover:flex',
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
