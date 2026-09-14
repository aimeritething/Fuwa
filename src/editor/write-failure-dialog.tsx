import type { WritePrompt, WritePromptChoice } from './use-write-failures'
import { Button } from '@/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog'

export interface WriteFailureDialogProps {
  prompt: WritePrompt | null
  onAnswer: (choice: WritePromptChoice) => void
  /** Escape or a click outside: keep the Tab, or the app, open with its bar. */
  onDismiss: () => void
}

/**
 * The only prompt in the app: closing a Tab whose write was
 * refused asks Retry or Discard changes instead of closing silently; ⌘Q with a
 * refused flush asks the same plus Discard and quit. Retry is the primary
 * control, the rest are the secondary control.
 */
export function WriteFailureDialog({ prompt, onAnswer, onDismiss }: WriteFailureDialogProps) {
  return (
    <Dialog open={prompt !== null} onOpenChange={(open) => { if (!open) onDismiss() }}>
      {prompt && (
        <DialogContent className="fuwa-write-failure-dialog" showCloseButton={false} data-testid="write-failure-dialog">
          <DialogHeader>
            <DialogTitle>Couldn't save to {prompt.path}</DialogTitle>
            <DialogDescription>{prompt.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="sm" onClick={() => onAnswer('retry')}>Retry</Button>
            <Button size="sm" variant="secondary" onClick={() => onAnswer('discard')}>Discard changes</Button>
            {prompt.kind === 'quit' && (
              <Button size="sm" variant="secondary" onClick={() => onAnswer('discardAndQuit')}>Discard and quit</Button>
            )}
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  )
}
