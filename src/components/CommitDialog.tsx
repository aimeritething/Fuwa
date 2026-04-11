import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface CommitDialogProps {
  open: boolean
  modifiedCount: number
  suggestedMessage?: string
  onCommit: (message: string) => void
  onClose: () => void
}

export function CommitDialog({ open, modifiedCount, suggestedMessage, onCommit, onClose }: CommitDialogProps) {
  const [message, setMessage] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setMessage(suggestedMessage ?? '') // eslint-disable-line react-hooks/set-state-in-effect -- reset on dialog open
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps -- only reset when dialog opens

  const handleSubmit = () => {
    const trimmed = message.trim()
    if (!trimmed) return
    onCommit(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent showCloseButton={false} className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Commit & Push</DialogTitle>
            <Badge variant="secondary" className="text-xs">
              {modifiedCount} file{modifiedCount !== 1 ? 's' : ''} changed
            </Badge>
          </div>
          <DialogDescription className="sr-only">
            Review changed files and enter a commit message before committing and pushing.
          </DialogDescription>
        </DialogHeader>
        <textarea
          ref={inputRef}
          className="w-full resize-y rounded-lg border border-input bg-[var(--bg-input)] px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-ring"
          placeholder="Commit message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
        />
        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <span className="text-[11px] text-muted-foreground">Cmd+Enter to commit</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!message.trim()}>
              Commit & Push
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
