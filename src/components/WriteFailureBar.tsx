import { Button } from './ui/button'

export interface WriteFailureBarProps {
  path: string
  /** What the boundary said when it refused the write. */
  message: string
  onRetry: () => void
  onDiscard: () => void
}

/**
 * The error bar (spec section 5): shown on a Tab whose last write was
 * refused, between the path row and the content. The buffer keeps the edit;
 * Retry writes it again and Discard changes puts the disk bytes back. Drawn as
 * a Linear callout in the red chromatic role, with Retry as the primary
 * control. Never on an Image Tab, which is never written.
 */
export function WriteFailureBar({ path, message, onRetry, onDiscard }: WriteFailureBarProps) {
  return (
    <div className="fuwa-write-failure" role="alert" data-testid="write-failure-bar">
      <div className="fuwa-write-failure__text">
        <span className="fuwa-write-failure__title">Couldn't save to {path}</span>
        <span className="fuwa-write-failure__detail">{message}</span>
      </div>
      <div className="fuwa-write-failure__actions">
        <Button size="sm" onClick={onRetry}>Retry</Button>
        <Button size="sm" variant="secondary" onClick={onDiscard}>Discard changes</Button>
      </div>
    </div>
  )
}
