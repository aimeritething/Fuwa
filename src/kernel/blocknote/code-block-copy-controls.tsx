import { Copy } from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppLocale } from '@/lib/i18n'
import { createTranslator } from '@/lib/i18n'
import { trackEvent } from '@/lib/telemetry'
import { writeClipboardText } from '@/platform/clipboard-text'
import { codeBlockText } from './editor-rich-copy'
import { Button } from '@/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import type { CodeBlockCopyTarget } from './use-code-block-copy-target'

const CODE_BLOCK_COPY_RESET_MS = 1200

function stopCopyButtonEvent(event: React.MouseEvent<HTMLButtonElement>): void {
  event.preventDefault()
  event.stopPropagation()
}

function reportCopyFailure(error: unknown): void {
  console.warn('[editor] Failed to copy code block:', error)
}

function useCodeBlockCopyAction(copyTarget: CodeBlockCopyTarget) {
  const [active, setActive] = useState(false)
  const resetTimerRef = useRef<number | null>(null)
  useEffect(() => () => {
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current)
  }, [])
  const handleCopy = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    stopCopyButtonEvent(event)
    void writeClipboardText(codeBlockText(copyTarget.codeBlock)).then(() => {
      trackEvent('code_block_copied')
      setActive(true)
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current)
      resetTimerRef.current = window.setTimeout(() => {
        setActive(false)
        resetTimerRef.current = null
      }, CODE_BLOCK_COPY_RESET_MS)
    }).catch(reportCopyFailure)
  }, [copyTarget])
  return { active, handleCopy, setActive }
}

export function CodeBlockCopyButton({ copyTarget, locale }: { copyTarget: CodeBlockCopyTarget; locale: AppLocale }) {
  const t = useMemo(() => createTranslator(locale), [locale])
  const label = t('editor.codeBlock.copy')
  const { active, handleCopy, setActive } = useCodeBlockCopyAction(copyTarget)
  return (
    <div className="absolute z-raised" contentEditable={false} data-editor-code-copy style={{ left: copyTarget.left, top: copyTarget.top }}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={label}
            className="border-transparent bg-transparent text-text-secondary shadow-none hover:bg-transparent hover:text-text-primary focus-visible:bg-transparent focus-visible:text-text-primary"
            onBlur={() => setActive(false)}
            onClick={handleCopy}
            onFocus={() => setActive(true)}
            onMouseDown={stopCopyButtonEvent}
            onMouseEnter={() => setActive(true)}
            onMouseLeave={() => setActive(false)}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <Copy aria-hidden="true" className="size-6" weight={active ? 'fill' : 'regular'} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" align="center">{label}</TooltipContent>
      </Tooltip>
    </div>
  )
}
