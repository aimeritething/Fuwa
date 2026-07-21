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
    <main
      className="text-foreground flex h-screen bg-transparent p-5"
      data-quick-launcher-frame
      data-testid="quick-launcher-frame"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) void hideQuickLauncherWindow()
      }}
    >
      <section
        className="bg-popover flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border-dialog)] shadow-[0_24px_64px_var(--shadow-dialog),0_8px_24px_var(--shadow-dialog)]"
        data-testid="quick-launcher-surface"
      >
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
      </section>
    </main>
  )
}
