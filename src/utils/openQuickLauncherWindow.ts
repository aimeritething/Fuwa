import { isTauri } from '../mock-tauri'
import { resolveEffectiveLocale, translate } from '../lib/i18n'
import { trackQuickLauncherOpened } from '../lib/productAnalytics'

function quickLauncherNativeCopy() {
  const locale = resolveEffectiveLocale(document.documentElement.lang)
  return {
    clearBackgroundError: translate(locale, 'quickLauncher.native.error.clearBackground'),
    createError: translate(locale, 'quickLauncher.native.error.create'),
    desktopOnlyError: translate(locale, 'quickLauncher.native.error.desktopOnly'),
    disableShadowError: translate(locale, 'quickLauncher.native.error.disableShadow'),
    focusError: translate(locale, 'quickLauncher.native.error.focus'),
    showError: translate(locale, 'quickLauncher.native.error.show'),
    title: translate(locale, 'quickLauncher.native.title'),
    titleError: translate(locale, 'quickLauncher.native.error.title'),
    unminimizeError: translate(locale, 'quickLauncher.native.error.unminimize'),
  }
}

export async function openQuickLauncherWindow(): Promise<void> {
  if (!isTauri()) return

  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('show_quick_launcher', { copy: quickLauncherNativeCopy() })
  trackQuickLauncherOpened()
}

export async function hideQuickLauncherWindow(): Promise<void> {
  if (!isTauri()) return
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  await getCurrentWindow().hide()
}
