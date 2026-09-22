import { createContext, createElement, useContext, type ReactNode } from 'react'
import { DEFAULT_APP_LOCALE, type AppLocale } from './i18n'

/**
 * Plumo has no settings screen, so there is nothing to prefer yet. The provider
 * and `useAppLocale` stay on the kernel's module path because the editor blocks
 * read the locale from context.
 */

const AppLocaleContext = createContext<AppLocale>(DEFAULT_APP_LOCALE)

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  return createElement(AppLocaleContext.Provider, { value: DEFAULT_APP_LOCALE }, children)
}

export function useAppLocale(): AppLocale {
  return useContext(AppLocaleContext)
}
