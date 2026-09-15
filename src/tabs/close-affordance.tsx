import type { MouseEvent } from 'react'
import { X } from '@phosphor-icons/react'

interface CloseAffordanceProps {
  /** The name of the thing that closes, for the accessible label. */
  name: string
  onClose: () => void
}

/**
 * The × that closes a Tab from the tab bar or an Open Editors row. Hidden
 * until its row is hovered or selected: the row is a `group`, and this reads
 * the row's hover and `aria-selected`. The click stops at the button so the
 * row underneath is not activated.
 */
export function CloseAffordance({ name, onClose }: CloseAffordanceProps) {
  const close = (event: MouseEvent) => {
    event.stopPropagation()
    onClose()
  }

  return (
    <button
      type="button"
      className="flex size-4.5 flex-none cursor-default items-center justify-center rounded-sm border-0 bg-transparent p-0 text-text-secondary opacity-0 group-hover:opacity-100 group-aria-selected:opacity-100 hover:bg-control-tertiary-hover hover:text-text-heading"
      aria-label={`Close ${name}`}
      tabIndex={-1}
      onClick={close}
    >
      <X size={12} weight="bold" aria-hidden="true" />
    </button>
  )
}
