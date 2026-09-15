export interface ToastProps {
  /** The message, or null when there is nothing to say. */
  message: string | null
}

/**
 * The toast: one line at the bottom of the editor card, in the popover
 * material with the menu's shadow, saying what an Explorer operation refused
 * to do. It dismisses itself, has no controls, and never blocks what is
 * under it.
 */
export function Toast({ message }: ToastProps) {
  if (!message) return null
  return (
    <div
      className="pointer-events-none absolute bottom-4 left-1/2 z-toast max-w-[min(420px,calc(100%_-_32px))] -translate-x-1/2 rounded-lg border-hairline border-border-popover bg-surface-popover px-3 py-1.75 text-sm tracking-[-0.01em] wrap-anywhere text-text-primary shadow-menu"
      role="status"
      data-testid="toast"
    >
      {message}
    </div>
  )
}
