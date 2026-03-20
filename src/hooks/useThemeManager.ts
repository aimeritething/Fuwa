import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import { parseFrontmatter } from '../utils/frontmatter'
import type { ThemeFile, VaultEntry, VaultSettings } from '../types'

function tauriCall<T>(command: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : mockInvoke<T>(command, args)
}

/** Frontmatter keys that are metadata — not CSS custom properties. */
const NON_THEME_KEYS = new Set([
  'Is A', 'type', 'is_a', 'is a',
  'Name', 'name', 'title', 'Title',
  'Description', 'description',
  'Archived', 'archived',
  'Trashed', 'trashed',
  'Trashed at', 'trashed at', 'trashed_at',
  'Created at', 'created at', 'created_at',
  'Created time', 'created_time',
  'Owner', 'owner',
  'Status', 'status',
  'Cadence', 'cadence',
  'aliases',
  'Belongs to', 'belongs_to', 'belongs to',
  'Related to', 'related_to', 'related to',
])

/** Extract CSS custom properties from a theme note's frontmatter content. */
export function extractCssVars(content: string): Record<string, string> {
  const fm = parseFrontmatter(content)
  const vars: Record<string, string> = {}
  for (const [key, value] of Object.entries(fm)) {
    if (NON_THEME_KEYS.has(key)) continue
    if (typeof value === 'string' && value) {
      vars[`--${key}`] = value
    } else if (typeof value === 'number') {
      vars[`--${key}`] = String(value)
    }
  }
  return vars
}

/** Extract bare colors (without -- prefix) for ThemeFile.colors from content. */
function extractColorsFromContent(content: string): Record<string, string> {
  const fm = parseFrontmatter(content)
  const colors: Record<string, string> = {}
  for (const [key, value] of Object.entries(fm)) {
    if (NON_THEME_KEYS.has(key)) continue
    if (typeof value === 'string' && value.startsWith('#')) {
      colors[key] = value
    }
  }
  return colors
}

/** Check if a hex color is perceptually dark (luminance < 0.5). */
export function isColorDark(hex: string): boolean {
  if (!hex.startsWith('#') || hex.length < 7) return false
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5
}

/** Update color-scheme and data-theme-mode on document root based on --background. */
function updateColorScheme(vars: Record<string, string>): void {
  const bg = vars['--background']
  if (!bg) return
  const dark = isColorDark(bg)
  const root = document.documentElement
  root.style.setProperty('color-scheme', dark ? 'dark' : 'light')
  root.dataset.themeMode = dark ? 'dark' : 'light'
}

function clearColorScheme(): void {
  const root = document.documentElement
  root.style.removeProperty('color-scheme')
  delete root.dataset.themeMode
}

const THEME_STYLE_ID = 'laputa-theme-vars'

function getOrCreateThemeStyle(): HTMLStyleElement {
  let el = document.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = THEME_STYLE_ID
    document.head.appendChild(el)
  }
  return el
}

function applyVarsToDom(vars: Record<string, string>): void {
  const root = document.documentElement
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
  updateColorScheme(vars)
  // WKWebView doesn't invalidate ::before/::after pseudo-element styles when
  // CSS custom properties change via inline styles alone — `void offsetHeight`
  // triggers layout reflow but not style recalculation on pseudo-elements.
  // Replacing a <style> element's content forces a full style tree invalidation
  // that covers pseudo-elements using var() references (e.g. bullet size/color).
  const css = Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')
  getOrCreateThemeStyle().textContent = `:root{${css}}`
}

function clearVarsFromDom(vars: Record<string, string>): void {
  const root = document.documentElement
  for (const key of Object.keys(vars)) {
    root.style.removeProperty(key)
  }
  getOrCreateThemeStyle().textContent = ''
  clearColorScheme()
}

/** Build a ThemeFile descriptor from a vault entry, enriched with content colors. */
function entryToThemeFile(entry: VaultEntry, content: string | undefined): ThemeFile {
  return {
    id: entry.path,
    name: entry.title,
    description: '',
    path: entry.path,
    colors: content ? extractColorsFromContent(content) : {},
    typography: {},
    spacing: {},
  }
}

/** True when a theme entry should no longer be applied (trashed or archived). */
function isEntryRemoved(entry: VaultEntry): boolean {
  return entry.trashed || entry.archived
}

export interface ThemeManager {
  themes: ThemeFile[]
  activeThemeId: string | null
  activeTheme: ThemeFile | null
  activeThemeContent: string | undefined
  isDark: boolean
  switchTheme: (themeId: string) => Promise<void>
  createTheme: (name?: string) => Promise<string>
  reloadThemes: () => Promise<void>
  /** Update a single frontmatter property on the active theme note. */
  updateThemeProperty: (key: string, value: string) => Promise<void>
  /** Notify that the active theme note was saved with new content (live-reload on Cmd+S). */
  notifyThemeSaved: (path: string, content: string) => void
}

/** Manages loading and persisting the active theme path from vault settings. */
function useThemeSetting(vaultPath: string | null) {
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!vaultPath) return
    try {
      const s = await tauriCall<VaultSettings>('get_vault_settings', { vaultPath })
      setActiveThemeId(s.theme)
    } catch { /* no settings file — fine, no active theme */ }
  }, [vaultPath])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- async fn; setState runs after await
  useEffect(() => { load() }, [load])

  useEffect(() => {
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [load])

  return { activeThemeId, setActiveThemeId, reload: load }
}

/** Applies CSS custom properties to the document root from the active theme. */
function useThemeApplier(
  activeThemeId: string | null,
  cachedContent: string | undefined,
) {
  const appliedVarsRef = useRef<Record<string, string>>({})
  const [isDark, setIsDark] = useState(false)
  const versionRef = useRef(0)

  const applyDom = useCallback((content: string) => {
    const newVars = extractCssVars(content)
    clearVarsFromDom(appliedVarsRef.current)
    applyVarsToDom(newVars)
    appliedVarsRef.current = newVars
    return newVars
  }, [])

  const clearDom = useCallback(() => {
    clearVarsFromDom(appliedVarsRef.current)
    appliedVarsRef.current = {}
  }, [])

  // Apply theme when activeThemeId or cached content changes.
  // Also serves as live-preview: re-applies when the user saves the theme note.
  useEffect(() => {
    const version = ++versionRef.current
    if (!activeThemeId) {
      clearDom()
      setIsDark(false) // eslint-disable-line react-hooks/set-state-in-effect -- sync dark mode with cleared theme
      return
    }
    if (cachedContent) {
      const vars = applyDom(cachedContent)
      setIsDark(isColorDark(vars['--background'] ?? ''))
      return
    }
    tauriCall<string>('get_note_content', { path: activeThemeId })
      .then(content => {
        if (versionRef.current !== version) return
        const vars = applyDom(content)
        setIsDark(isColorDark(vars['--background'] ?? ''))
      })
      .catch(() => {
        if (versionRef.current !== version) return
        clearDom(); setIsDark(false)
      })
  }, [activeThemeId, cachedContent, applyDom, clearDom])

  return { clearDom, isDark }
}

/** Deactivate the theme and persist `null` to vault settings. */
function deactivateTheme(
  vaultPath: string | null,
  clearTheme: () => void,
  setActiveThemeId: (id: string | null) => void,
) {
  clearTheme()
  setActiveThemeId(null)
  if (vaultPath) tauriCall('set_active_theme', { vaultPath, themeId: null }).catch(() => {})
}

/** True when the active theme should be cleared (stale, trashed, or archived). */
function shouldDeactivate(
  activeThemeId: string | null,
  themes: ThemeFile[],
  entries: VaultEntry[],
  userSetId: string | null,
): boolean {
  if (!activeThemeId) return false
  // Stale ID from old theme system — skip IDs just set by user action
  if (themes.length > 0 && activeThemeId !== userSetId && !themes.some(t => t.id === activeThemeId)) return true
  // Trashed or archived
  const entry = entries.find(e => e.path === activeThemeId)
  return !!entry && isEntryRemoved(entry)
}

export function useThemeManager(
  vaultPath: string | null,
  entries: VaultEntry[],
): ThemeManager {
  useEffect(() => {
    if (vaultPath) tauriCall('ensure_vault_themes', { vaultPath }).catch(() => {})
  }, [vaultPath])

  const { activeThemeId, setActiveThemeId, reload } = useThemeSetting(vaultPath)
  const [cachedThemeContent, setCachedThemeContent] = useState<string | undefined>(undefined)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setCachedThemeContent(undefined) }, [activeThemeId])

  const { clearDom: clearTheme, isDark } = useThemeApplier(activeThemeId, cachedThemeContent)
  const userSetIdRef = useRef<string | null>(null)

  const themes = useMemo(
    () => entries
      .filter(e => e.isA === 'Theme' && !e.trashed && !e.archived)
      .map(e => entryToThemeFile(e, e.path === activeThemeId ? cachedThemeContent : undefined)),
    [entries, activeThemeId, cachedThemeContent],
  )

  const activeTheme = useMemo(
    () => themes.find(t => t.id === activeThemeId) ?? null,
    [themes, activeThemeId],
  )

  // Deactivate stale, trashed, or archived theme
  useEffect(() => {
    if (shouldDeactivate(activeThemeId, themes, entries, userSetIdRef.current)) {
      deactivateTheme(vaultPath, clearTheme, setActiveThemeId)
    }
  }, [activeThemeId, themes, entries, clearTheme, vaultPath, setActiveThemeId])

  const switchTheme = useCallback(async (themeId: string) => {
    if (!vaultPath) return
    try {
      await tauriCall<null>('set_active_theme', { vaultPath, themeId })
      userSetIdRef.current = themeId
      setActiveThemeId(themeId)
    } catch (err) { console.error('Failed to switch theme:', err) }
  }, [vaultPath, setActiveThemeId])

  const createTheme = useCallback(async (name?: string) => {
    if (!vaultPath) return ''
    try {
      const path = await tauriCall<string>('create_vault_theme', { vaultPath, name: name ?? null })
      await tauriCall<null>('set_active_theme', { vaultPath, themeId: path })
      userSetIdRef.current = path
      setActiveThemeId(path)
      return path
    } catch (err) { console.error('Failed to create theme:', err); return '' }
  }, [vaultPath, setActiveThemeId])

  const reloadThemes = useCallback(async () => { await reload() }, [reload])

  const notifyThemeSaved = useCallback((path: string, content: string) => {
    if (path === activeThemeId) setCachedThemeContent(content)
  }, [activeThemeId])

  const updateThemeProperty = useCallback(async (key: string, value: string) => {
    if (!activeThemeId) return
    try {
      const newContent = await tauriCall<string>('update_frontmatter', {
        path: activeThemeId, key, value,
      })
      setCachedThemeContent(newContent)
    } catch (err) { console.error('Failed to update theme property:', err) }
  }, [activeThemeId])

  return {
    themes, activeThemeId, activeTheme,
    activeThemeContent: cachedThemeContent,
    isDark, switchTheme, createTheme, reloadThemes, updateThemeProperty, notifyThemeSaved,
  }
}
