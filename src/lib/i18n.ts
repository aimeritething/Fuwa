import { EN_TRANSLATIONS } from './locales/en'
import { ZH_HANS_TRANSLATIONS } from './locales/zh-Hans'

export const DEFAULT_APP_LOCALE = 'en'
export const SYSTEM_UI_LANGUAGE = 'system'

export const APP_LOCALES = ['en', 'zh-Hans'] as const
export type AppLocale = typeof APP_LOCALES[number]
export type UiLanguagePreference = typeof SYSTEM_UI_LANGUAGE | AppLocale
export type TranslationKey = keyof typeof EN_TRANSLATIONS
export type TranslationValues = Record<string, string | number>

export { EN_TRANSLATIONS, ZH_HANS_TRANSLATIONS }

const SIMPLIFIED_CHINESE_LANGUAGE_CODES = new Set(['zh', 'zh-cn', 'zh-hans', 'zh-sg'])

const TRANSLATIONS: Record<AppLocale, Partial<Record<TranslationKey, string>>> = {
  en: EN_TRANSLATIONS,
  'zh-Hans': ZH_HANS_TRANSLATIONS,
}

export function interpolate(template: string, values: TranslationValues = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = values[key]
    return value === undefined ? match : String(value)
  })
}

export function translate(locale: AppLocale, key: TranslationKey, values?: TranslationValues): string {
  const template = TRANSLATIONS[locale]?.[key] ?? EN_TRANSLATIONS[key]
  return interpolate(template, values)
}

export function createTranslator(locale: AppLocale = DEFAULT_APP_LOCALE) {
  return (key: TranslationKey, values?: TranslationValues) => translate(locale, key, values)
}

function normalizeLocaleCode(value: string): AppLocale | null {
  const normalized = value.trim().replace('_', '-').toLowerCase()
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en'
  if (SIMPLIFIED_CHINESE_LANGUAGE_CODES.has(normalized)) return 'zh-Hans'
  return null
}

export function normalizeUiLanguagePreference(value: unknown): UiLanguagePreference | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  if (lower === SYSTEM_UI_LANGUAGE || lower === 'auto') return SYSTEM_UI_LANGUAGE
  return normalizeLocaleCode(trimmed)
}

export function serializeUiLanguagePreference(value: unknown): AppLocale | null {
  const normalized = normalizeUiLanguagePreference(value)
  if (!normalized || normalized === SYSTEM_UI_LANGUAGE) return null
  return normalized
}

export function getBrowserLanguagePreferences(): string[] {
  if (typeof navigator === 'undefined') return []
  const languages = Array.isArray(navigator.languages) ? navigator.languages : []
  if (languages.length > 0) return [...languages]
  return navigator.language ? [navigator.language] : []
}

export function resolveEffectiveLocale(
  preference: unknown,
  languagePreferences: readonly string[] = getBrowserLanguagePreferences(),
): AppLocale {
  const normalizedPreference = normalizeUiLanguagePreference(preference)
  if (normalizedPreference && normalizedPreference !== SYSTEM_UI_LANGUAGE) {
    return normalizedPreference
  }

  for (const language of languagePreferences) {
    const locale = normalizeLocaleCode(language)
    if (locale) return locale
  }

  return DEFAULT_APP_LOCALE
}

export function localeDisplayName(locale: AppLocale, displayLocale: AppLocale = locale): string {
  return translate(displayLocale, locale === 'zh-Hans' ? 'locale.zhHans' : 'locale.en')
}
