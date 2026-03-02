import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import { parseFrontmatter } from '../utils/frontmatter'
import type { ThemeFile, VaultEntry, VaultSettings } from '../types'

function tauriCall<T>(command: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : mockInvoke<T>(command, args)
}

<<<<<<< HEAD
// --- Color utilities for theme variable derivation ---

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('')
}

/** Blend two hex colors. ratio=0 → color1, ratio=1 → color2. */
function mixColors(hex1: string, hex2: string, ratio: number): string {
  const [r1, g1, b1] = parseHex(hex1)
  const [r2, g2, b2] = parseHex(hex2)
  return toHex(r1 + (r2 - r1) * ratio, g1 + (g2 - g1) * ratio, b1 + (b2 - b1) * ratio)
}

/** Check if a hex color is perceptually dark (luminance < 0.5). */
export function isColorDark(hex: string): boolean {
  const [r, g, b] = parseHex(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5
}

// Variables derived from theme core colors (not present in theme.colors directly)
const DERIVED_VAR_NAMES = [
  'bg-primary', 'bg-sidebar', 'bg-card', 'bg-hover', 'bg-hover-subtle', 'bg-selected',
  'bg-input', 'bg-button', 'bg-dialog',
  'text-primary', 'text-heading', 'text-secondary', 'text-tertiary', 'text-muted', 'text-faint',
  'border-primary', 'border-subtle', 'border-input', 'border-dialog',
  'link-color', 'link-hover',
  // shadcn variables that may not be in the theme
  'card', 'card-foreground', 'popover', 'popover-foreground',
  'secondary', 'secondary-foreground', 'muted-foreground',
  'accent', 'accent-foreground', 'input', 'ring',
  'sidebar-foreground', 'sidebar-primary', 'sidebar-primary-foreground',
  'sidebar-accent', 'sidebar-accent-foreground', 'sidebar-border', 'sidebar-ring',
]

/** Derive app-specific and missing shadcn CSS variables from core theme colors. */
function deriveThemeVariables(root: HTMLElement, colors: Record<string, string>): void {
  const bg = colors.background
  const fg = colors.foreground
  if (!bg || !fg) return

  const isDark = isColorDark(bg)
  root.style.setProperty('color-scheme', isDark ? 'dark' : 'light')
  root.dataset.themeMode = isDark ? 'dark' : 'light'

  const primary = colors.primary ?? (isDark ? '#5C9CFF' : '#155DFF')
  const border = colors.border ?? mixColors(bg, fg, isDark ? 0.15 : 0.08)
  const muted = colors.muted ?? mixColors(bg, fg, isDark ? 0.08 : 0.05)
  const sidebarBg = colors['sidebar-background'] ?? mixColors(bg, fg, 0.04)

  // App-specific variables
  root.style.setProperty('--bg-primary', bg)
  root.style.setProperty('--bg-sidebar', sidebarBg)
  root.style.setProperty('--bg-card', mixColors(bg, fg, 0.03))
  root.style.setProperty('--bg-hover', mixColors(bg, fg, 0.1))
  root.style.setProperty('--bg-hover-subtle', muted)
  root.style.setProperty('--bg-selected', `${primary}25`)
  root.style.setProperty('--bg-input', bg)
  root.style.setProperty('--bg-button', mixColors(bg, fg, 0.1))
  root.style.setProperty('--bg-dialog', mixColors(bg, fg, 0.02))

  root.style.setProperty('--text-primary', fg)
  root.style.setProperty('--text-heading', fg)
  root.style.setProperty('--text-secondary', mixColors(fg, bg, 0.25))
  root.style.setProperty('--text-tertiary', mixColors(fg, bg, 0.35))
  root.style.setProperty('--text-muted', mixColors(fg, bg, 0.5))
  root.style.setProperty('--text-faint', mixColors(fg, bg, 0.6))

  root.style.setProperty('--border-primary', border)
  root.style.setProperty('--border-subtle', border)
  root.style.setProperty('--border-input', border)
  root.style.setProperty('--border-dialog', border)

  root.style.setProperty('--link-color', primary)
  root.style.setProperty('--link-hover', mixColors(primary, fg, 0.2))

  // Shadcn variables — only set if not already provided by the theme
  const setIfMissing = (name: string, value: string) => {
    if (!(name in colors)) root.style.setProperty(`--${name}`, value)
  }
  setIfMissing('card', mixColors(bg, fg, 0.03))
  setIfMissing('card-foreground', fg)
  setIfMissing('popover', mixColors(bg, fg, 0.04))
  setIfMissing('popover-foreground', fg)
  setIfMissing('secondary', mixColors(bg, fg, 0.08))
  setIfMissing('secondary-foreground', fg)
  setIfMissing('muted-foreground', mixColors(fg, bg, 0.3))
  setIfMissing('accent', mixColors(bg, fg, 0.08))
  setIfMissing('accent-foreground', fg)
  setIfMissing('input', border)
  setIfMissing('ring', primary)
  setIfMissing('sidebar-foreground', fg)
  setIfMissing('sidebar-accent', mixColors(sidebarBg, fg, 0.1))
  setIfMissing('sidebar-accent-foreground', fg)
  setIfMissing('sidebar-border', border)
  setIfMissing('sidebar-primary', primary)
  setIfMissing('sidebar-primary-foreground', '#FFFFFF')
  setIfMissing('sidebar-ring', primary)
}

function clearDerivedVariables(root: HTMLElement): void {
  for (const name of DERIVED_VAR_NAMES) {
    root.style.removeProperty(`--${name}`)
  }
  root.style.removeProperty('color-scheme')
  delete root.dataset.themeMode
}

/** Map theme colors/typography/spacing to CSS custom properties on :root. */
function applyThemeToDom(theme: ThemeFile): void {
=======
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

function applyVarsToDom(vars: Record<string, string>): void {
>>>>>>> 240be0d (wip: themes-editable — theme management system WIP (13 files, 1014 insertions))
  const root = document.documentElement
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
  deriveThemeVariables(root, theme.colors)
}

function clearVarsFromDom(vars: Record<string, string>): void {
  const root = document.documentElement
  for (const key of Object.keys(vars)) {
    root.style.removeProperty(key)
  }
}

/** Build a ThemeFile descriptor from a vault entry (metadata only). */
function entryToThemeFile(entry: VaultEntry): ThemeFile {
  return {
    id: entry.path,
    name: entry.title,
    description: '',
    path: entry.path,
    colors: {},
    typography: {},
    spacing: {},
  }
<<<<<<< HEAD
  for (const key of Object.keys(theme.spacing)) {
    root.style.removeProperty(`--theme-${key}`)
  }
  root.style.removeProperty('--sidebar')
  clearDerivedVariables(root)
=======
}

/** True when a theme entry should no longer be applied (trashed or archived). */
function isEntryRemoved(entry: VaultEntry): boolean {
  return entry.trashed || entry.archived
>>>>>>> 240be0d (wip: themes-editable — theme management system WIP (13 files, 1014 insertions))
}

export interface ThemeManager {
  themes: ThemeFile[]
  activeThemeId: string | null
  activeTheme: ThemeFile | null
  isDark: boolean
  switchTheme: (themeId: string) => Promise<void>
  createTheme: (name?: string) => Promise<string>
  reloadThemes: () => Promise<void>
}

/** Manages loading and persisting the active theme path from vault settings. */
function useThemeSetting(vaultPath: string | null) {
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null)

<<<<<<< HEAD
  const activeTheme = themes.find(t => t.id === activeThemeId) ?? null
  const isDark = activeTheme?.colors.background ? isColorDark(activeTheme.colors.background) : false

  const loadThemes = useCallback(async () => {
=======
  const load = useCallback(async () => {
>>>>>>> 240be0d (wip: themes-editable — theme management system WIP (13 files, 1014 insertions))
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

  const apply = useCallback((content: string) => {
    const newVars = extractCssVars(content)
    clearVarsFromDom(appliedVarsRef.current)
    applyVarsToDom(newVars)
    appliedVarsRef.current = newVars
  }, [])

  const clear = useCallback(() => {
    clearVarsFromDom(appliedVarsRef.current)
    appliedVarsRef.current = {}
  }, [])

  // Apply theme when activeThemeId or cached content changes.
  // Also serves as live-preview: re-applies when the user saves the theme note.
  useEffect(() => {
    if (!activeThemeId) { clear(); return }
    if (cachedContent) { apply(cachedContent); return }
    tauriCall<string>('get_note_content', { path: activeThemeId })
      .then(apply)
      .catch(clear)
  }, [activeThemeId, cachedContent, apply, clear])

  return { clear }
}

export function useThemeManager(
  vaultPath: string | null,
  entries: VaultEntry[],
  allContent: Record<string, string>,
): ThemeManager {
  const { activeThemeId, setActiveThemeId, reload } = useThemeSetting(vaultPath)
  const cachedThemeContent = activeThemeId ? allContent[activeThemeId] : undefined
  const { clear: clearTheme } = useThemeApplier(activeThemeId, cachedThemeContent)

  const themes = useMemo(
    () => entries.filter(e => e.isA === 'Theme' && !e.trashed && !e.archived).map(entryToThemeFile),
    [entries],
  )

  const activeTheme = useMemo(
    () => themes.find(t => t.id === activeThemeId) ?? null,
    [themes, activeThemeId],
  )

  // If active theme is trashed or archived: clear CSS vars and fall back to no theme
  useEffect(() => {
    if (!activeThemeId) return
    const entry = entries.find(e => e.path === activeThemeId)
    if (!entry || !isEntryRemoved(entry)) return
    clearTheme()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync fallback when active theme is deleted
    setActiveThemeId(null)
    if (vaultPath) tauriCall('set_active_theme', { vaultPath, themeId: null }).catch(() => {})
  }, [entries, activeThemeId, clearTheme, vaultPath, setActiveThemeId])

  const switchTheme = useCallback(async (themeId: string) => {
    if (!vaultPath) return
    try {
      await tauriCall<null>('set_active_theme', { vaultPath, themeId })
      setActiveThemeId(themeId)
    } catch (err) { console.error('Failed to switch theme:', err) }
  }, [vaultPath, setActiveThemeId])

  const createTheme = useCallback(async (name?: string) => {
    if (!vaultPath) return ''
    try {
      const path = await tauriCall<string>('create_vault_theme', { vaultPath, name: name ?? null })
      await tauriCall<null>('set_active_theme', { vaultPath, themeId: path })
      setActiveThemeId(path)
      return path
    } catch (err) { console.error('Failed to create theme:', err); return '' }
  }, [vaultPath, setActiveThemeId])

<<<<<<< HEAD
  return { themes, activeThemeId, activeTheme, isDark, switchTheme, createTheme, reloadThemes: loadThemes }
=======
  const reloadThemes = useCallback(async () => { await reload() }, [reload])

  return { themes, activeThemeId, activeTheme, switchTheme, createTheme, reloadThemes }
>>>>>>> 240be0d (wip: themes-editable — theme management system WIP (13 files, 1014 insertions))
}
