import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Megaphone } from '@phosphor-icons/react'
import { ArrowUpRight, Bug, Check, Copy, GitPullRequest, Lightbulb, MessagesSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  TOLARIA_CANNY_URL,
  TOLARIA_GITHUB_CONTRIBUTING_URL,
  TOLARIA_GITHUB_DISCUSSIONS_URL,
  TOLARIA_GITHUB_ISSUES_URL,
} from '../constants/feedback'
import {
  buildSanitizedDiagnosticBundle,
  startFeedbackDiagnosticsCapture,
} from '../lib/feedbackDiagnostics'
import { takeFeedbackDialogOpener } from '../lib/feedbackDialogOpener'
import { useBuildNumber } from '../hooks/useBuildNumber'
import { APP_COMMAND_EVENT_NAME, APP_COMMAND_IDS } from '../hooks/appCommandDispatcher'
import { openExternalUrl } from '../utils/url'

interface FeedbackDialogProps {
  open: boolean
  onClose: () => void
  buildNumber?: string
  releaseChannel?: string | null
}

interface ContributionCardProps {
  title: string
  description: string
  ctaLabel: string
  icon: typeof Lightbulb
  onAction: () => void
  autoFocus?: boolean
  secondaryAction?: ReactNode
}

interface LinkFallback {
  label: string
  url: string
}

interface ContributionPath {
  title: string
  description: string
  ctaLabel: string
  label: string
  url: string
  icon: typeof Lightbulb
}

const EMPTY_DIALOG_OPENER: ReturnType<typeof takeFeedbackDialogOpener> = {
  element: null,
  reopenCommandPalette: false,
}

const CONTRIBUTION_PATHS: ContributionPath[] = [
  {
    title: 'Feature request / improvement idea',
    description: 'Search Canny first, upvote an existing idea if it is already there, and only create a new post when it is genuinely new.',
    ctaLabel: 'Open Canny',
    label: 'Canny',
    url: TOLARIA_CANNY_URL,
    icon: Lightbulb,
  },
  {
    title: 'Community / discussion',
    description: 'Use Discussions for questions, broader conversations, idea sharing, and community context that is not a concrete bug report.',
    ctaLabel: 'Open Discussions',
    label: 'GitHub Discussions',
    url: TOLARIA_GITHUB_DISCUSSIONS_URL,
    icon: MessagesSquare,
  },
  {
    title: 'Contribute code',
    description: 'Small, focused pull requests are welcome. Check planned or in-progress work first so you are building in the right place.',
    ctaLabel: 'Open Contributing Guide',
    label: 'the contributing guide',
    url: TOLARIA_GITHUB_CONTRIBUTING_URL,
    icon: GitPullRequest,
  },
]

function ContributionCard({
  title,
  description,
  ctaLabel,
  icon: Icon,
  onAction,
  autoFocus = false,
  secondaryAction,
}: ContributionCardProps) {
  return (
    <Card className="gap-4 border-border/70 py-4 shadow-none">
      <CardHeader className="gap-3 px-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className="rounded-md bg-muted p-2 text-muted-foreground">
            <Icon size={16} />
          </span>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </div>
        <CardDescription className="text-sm leading-6 text-muted-foreground">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <Button type="button" variant="secondary" className="w-full justify-between" autoFocus={autoFocus} onClick={onAction}>
          {ctaLabel}
          <ArrowUpRight size={14} />
        </Button>
      </CardContent>
      {secondaryAction ? <CardFooter className="px-4 pt-0">{secondaryAction}</CardFooter> : null}
    </Card>
  )
}

function LinkFallbackBanner({ linkFallback }: { linkFallback: LinkFallback | null }) {
  if (!linkFallback) return null

  return (
    <div
      className="rounded-lg border px-4 py-3 text-sm"
      style={{
        background: 'var(--feedback-warning-bg)',
        borderColor: 'var(--feedback-warning-border)',
        color: 'var(--feedback-warning-text)',
      }}
    >
      <p className="font-medium">Couldn’t open {linkFallback.label} automatically.</p>
      <p className="mt-1">Open this URL manually instead:</p>
      <p className="mt-2 break-all rounded-md bg-popover px-3 py-2 font-mono text-xs text-foreground">
        {linkFallback.url}
      </p>
    </div>
  )
}

function BugReportActions({
  copyState,
  canCopyDiagnostics,
  onCopyDiagnostics,
}: {
  copyState: 'idle' | 'copied' | 'failed'
  canCopyDiagnostics: boolean
  onCopyDiagnostics: () => void
}) {
  return (
    <div className="flex w-full flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between"
        onClick={onCopyDiagnostics}
        disabled={!canCopyDiagnostics}
      >
        {copyState === 'copied' ? 'Diagnostics copied' : 'Copy diagnostics'}
        {copyState === 'copied' ? <Check size={14} /> : <Copy size={14} />}
      </Button>
      <p className="text-xs leading-5 text-muted-foreground">
        Sanitized and optional. Paths and token-like strings are redacted by default.
      </p>
      {copyState === 'copied' ? (
        <p className="text-xs font-medium text-foreground">Diagnostics copied.</p>
      ) : null}
      {copyState === 'failed' ? (
        <p className="text-xs font-medium text-[var(--feedback-warning-text)]">
          Clipboard access is unavailable right now. You can still open GitHub Issues directly.
        </p>
      ) : null}
    </div>
  )
}

function useDialogReturnFocus(open: boolean, onClose: () => void) {
  const openerRef = useRef(EMPTY_DIALOG_OPENER)

  useLayoutEffect(() => {
    if (open) {
      openerRef.current = takeFeedbackDialogOpener()
    }
  }, [open])

  return () => {
    const { element: opener, reopenCommandPalette } = openerRef.current
    openerRef.current = takeFeedbackDialogOpener()

    onClose()
    window.setTimeout(() => {
      if (reopenCommandPalette) {
        window.dispatchEvent(new CustomEvent(APP_COMMAND_EVENT_NAME, {
          detail: APP_COMMAND_IDS.viewCommandPalette,
        }))
        return
      }

      if (opener?.isConnected) {
        opener.focus()
      }
    }, 80)
  }
}

function useFeedbackDialogActions(diagnosticsBundle: string) {
  const [linkFallback, setLinkFallback] = useState<LinkFallback | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const canCopyDiagnostics = typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function'

  const handleOpenLink = (label: string, url: string) => {
    void openExternalUrl(url)
      .then(() => {
        setLinkFallback(null)
      })
      .catch(() => {
        setLinkFallback({ label, url })
      })
  }

  const handleCopyDiagnostics = () => {
    if (!canCopyDiagnostics) {
      setCopyState('failed')
      return
    }

    void navigator.clipboard.writeText(diagnosticsBundle)
      .then(() => {
        setCopyState('copied')
      })
      .catch(() => {
        setCopyState('failed')
      })
  }

  const reset = () => {
    setLinkFallback(null)
    setCopyState('idle')
  }

  return {
    linkFallback,
    copyState,
    canCopyDiagnostics,
    handleOpenLink,
    handleCopyDiagnostics,
    reset,
  }
}

function ContributionGrid({
  onOpenLink,
  copyState,
  canCopyDiagnostics,
  onCopyDiagnostics,
}: {
  onOpenLink: (label: string, url: string) => void
  copyState: 'idle' | 'copied' | 'failed'
  canCopyDiagnostics: boolean
  onCopyDiagnostics: () => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {CONTRIBUTION_PATHS.map((path, index) => (
        <ContributionCard
          key={path.title}
          title={path.title}
          description={path.description}
          ctaLabel={path.ctaLabel}
          icon={path.icon}
          autoFocus={index === 0}
          onAction={() => onOpenLink(path.label, path.url)}
        />
      ))}
      <ContributionCard
        title="Report a bug"
        description="A strong report explains the steps to reproduce, what you expected, and what actually happened. You can optionally paste a sanitized diagnostic bundle."
        ctaLabel="Open GitHub Issues"
        icon={Bug}
        onAction={() => onOpenLink('GitHub Issues', TOLARIA_GITHUB_ISSUES_URL)}
        secondaryAction={(
          <BugReportActions
            copyState={copyState}
            canCopyDiagnostics={canCopyDiagnostics}
            onCopyDiagnostics={onCopyDiagnostics}
          />
        )}
      />
    </div>
  )
}

export function FeedbackDialog({
  open,
  onClose,
  buildNumber,
  releaseChannel,
}: FeedbackDialogProps) {
  const detectedBuildNumber = useBuildNumber()
  const resolvedBuildNumber = buildNumber ?? detectedBuildNumber
  const diagnosticsBundle = useMemo(
    () => buildSanitizedDiagnosticBundle({ buildNumber: resolvedBuildNumber, releaseChannel }),
    [releaseChannel, resolvedBuildNumber],
  )
  const handleRequestClose = useDialogReturnFocus(open, onClose)
  const {
    linkFallback,
    copyState,
    canCopyDiagnostics,
    handleOpenLink,
    handleCopyDiagnostics,
    reset,
  } = useFeedbackDialogActions(diagnosticsBundle)

  useEffect(() => startFeedbackDiagnosticsCapture(), [])

  const handleClose = () => {
    reset()
    handleRequestClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose() }}>
      <DialogContent showCloseButton={false} className="max-h-[85vh] overflow-y-auto sm:max-w-[760px]" data-testid="feedback-dialog">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2">
            <Megaphone size={18} weight="duotone" />
            Contribute to Tolaria
          </DialogTitle>
          <DialogDescription>
            Pick the path that fits what you want to do. The links stay focused, the diagnostics are sanitized,
            and you can work through the whole flow with the keyboard.
          </DialogDescription>
        </DialogHeader>

        <LinkFallbackBanner linkFallback={linkFallback} />
        <ContributionGrid
          onOpenLink={handleOpenLink}
          copyState={copyState}
          canCopyDiagnostics={canCopyDiagnostics}
          onCopyDiagnostics={handleCopyDiagnostics}
        />

        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="outline" onClick={handleClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
