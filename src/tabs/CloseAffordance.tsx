import type { MouseEvent } from 'react'
import { X } from '@phosphor-icons/react'
import './CloseAffordance.css'

interface CloseAffordanceProps {
  /** The name of the thing that closes, for the accessible label. */
  name: string
  onClose: () => void
}

/**
 * The × that closes a Tab from the tab bar or an Open Editors row. Hidden
 * until its row is hovered or selected (the row's stylesheet decides); the
 * click stops at the button so the row underneath is not activated.
 */
export function CloseAffordance({ name, onClose }: CloseAffordanceProps) {
  const close = (event: MouseEvent) => {
    event.stopPropagation()
    onClose()
  }

  return (
    <button
      type="button"
      className="fuwa-close-affordance"
      aria-label={`Close ${name}`}
      tabIndex={-1}
      onClick={close}
    >
      <X size={12} weight="bold" aria-hidden="true" />
    </button>
  )
}
