import { useCallback, useEffect, useMemo, useState } from 'react'
import { createTranslator } from '../lib/i18n'
import { QuickLauncherSearchPanel } from './quick-launcher/QuickLauncherSearchPanel'
import { useQuickLauncherContext } from './quick-launcher/useQuickLauncherContext'
import { hideQuickLauncherWindow } from '../utils/openQuickLauncherWindow'

function useLauncherDismissal(onFocus: () => void): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void hideQuickLauncherWindow()
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onFocus])
}

export function QuickLauncherWindowApp() {
  const context = useQuickLauncherContext()
  const [invocationKey, setInvocationKey] = useState(0)
  const t = useMemo(() => createTranslator(context.locale), [context.locale])
  const handleFocus = useCallback(() => setInvocationKey((key) => key + 1), [])

  useLauncherDismissal(handleFocus)

  return (
    <main className="bg-popover text-foreground flex h-screen flex-col overflow-hidden rounded-xl border border-[var(--border-dialog)] shadow-[0_8px_32px_var(--shadow-dialog)]">
      <div className="h-2 shrink-0" data-tauri-drag-region />
      {context.loaded && (
        <QuickLauncherSearchPanel
          key={invocationKey}
          initialDestination={context.destinationResolution.destination}
          settings={context.settings}
          t={t}
          vaults={context.vaults}
        />
      )}
    </main>
  )
}
