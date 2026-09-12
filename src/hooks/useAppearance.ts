import { useCallback, useMemo, useState } from 'react'
import { DEFAULT_THEME_MODE, type ThemeMode } from '../lib/themeMode'

/**
 * The View → Appearance choice: dark on first launch, light
 * and system selectable, the choice living in the Session's `theme`. The
 * shell paints it with `useThemeMode` once the Session has been restored, so
 * a launch never flashes the default over a saved light theme; before that
 * the pre-paint script in index.html has applied the localStorage mirror,
 * which the theme applier keeps in step.
 */
export function useAppearance() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(DEFAULT_THEME_MODE)

  const restoreTheme = useCallback((theme: ThemeMode) => setThemeMode(theme), [])
  const handlers = useMemo(() => ({
    onAppearanceSystem: () => setThemeMode('system'),
    onAppearanceDark: () => setThemeMode('dark'),
    onAppearanceLight: () => setThemeMode('light'),
  }), [])

  return { themeMode, restoreTheme, handlers }
}
