import { useEffect, useMemo, useState } from 'react'
import { createTranslator } from '../lib/i18n'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { QuickLauncherSearchPanel } from './quick-launcher/QuickLauncherSearchPanel'
import { QuickCapturePanel } from './quick-launcher/QuickCapturePanel'
import { useQuickLauncherContext } from './quick-launcher/useQuickLauncherContext'
import { hideQuickLauncherWindow } from '../utils/openQuickLauncherWindow'

export function QuickLauncherWindowApp() {
  const context = useQuickLauncherContext()
  const [invocationKey, setInvocationKey] = useState(0)
  const t = useMemo(() => createTranslator(context.locale), [context.locale])

  useEffect(() => {
    const handleFocus = () => setInvocationKey((key) => key + 1)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void hideQuickLauncherWindow()
    }
    const handleBlur = () => {
      window.setTimeout(() => {
        const pickerOpen = document.querySelector('[data-slot="select-content"][data-state="open"]')
        if (!pickerOpen && !document.hasFocus()) void hideQuickLauncherWindow()
      }, 80)
    }
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <main className="bg-background text-foreground flex h-screen flex-col overflow-hidden border shadow-2xl">
      <div className="h-2 shrink-0" data-tauri-drag-region />
      <Tabs defaultValue="search" className="min-h-0 flex-1 gap-0 px-4 pb-4">
        <TabsList className="mb-3 grid w-full grid-cols-2">
          <TabsTrigger value="search">{t('quickLauncher.searchTab')}</TabsTrigger>
          <TabsTrigger value="capture">{t('quickLauncher.captureTab')}</TabsTrigger>
        </TabsList>
        {context.loaded && <>
          <TabsContent value="search" className="min-h-0 flex-1">
            <QuickLauncherSearchPanel key={invocationKey} t={t} vaults={context.vaults} />
          </TabsContent>
          <TabsContent value="capture" className="min-h-0 flex-1">
            <QuickCapturePanel initialDestination={context.destinationResolution.destination} settings={context.settings} t={t} vaults={context.vaults} />
          </TabsContent>
        </>}
      </Tabs>
    </main>
  )
}
