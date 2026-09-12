export interface ToastProps {
  /** The message, or null when there is nothing to say. */
  message: string | null
}

/**
 * The toast: one line at the bottom of the editor card, on
 * the menu surface with the menu's shadow, saying what an Explorer operation
 * refused to do. It dismisses itself, has no controls, and never blocks what
 * is under it.
 */
export function Toast({ message }: ToastProps) {
  if (!message) return null
  return (
    <div className="fuwa-toast" role="status" data-testid="toast">
      {message}
    </div>
  )
}
