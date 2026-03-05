import { ACCENT_COLORS } from './typeColors'
import { updateVaultConfigField } from './vaultConfigStore'

export interface TagStyle {
  bg: string
  color: string
}

export const DEFAULT_TAG_STYLE: TagStyle = {
  bg: 'var(--accent-blue-light)',
  color: 'var(--accent-blue)',
}

const STORAGE_KEY = 'laputa:tag-color-overrides'

const COLOR_KEY_TO_STYLE: Record<string, TagStyle> = Object.fromEntries(
  ACCENT_COLORS.map(c => [c.key, { bg: c.cssLight, color: c.css }]),
)

let colorOverrides: Record<string, string> = loadColorOverrides()

/** Initialize tag color overrides from vault config (replaces localStorage). */
export function initTagColors(overrides: Record<string, string>): void {
  colorOverrides = { ...overrides }
}

function loadColorOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export function setTagColor(tag: string, colorKey: string | null): void {
  if (colorKey === null) {
    delete colorOverrides[tag]
  } else {
    colorOverrides[tag] = colorKey
  }
  const snapshot = { ...colorOverrides }
  updateVaultConfigField('tag_colors', Object.keys(snapshot).length > 0 ? snapshot : null)
}

export function getTagColorKey(tag: string): string | null {
  return colorOverrides[tag] ?? null
}

export function getTagStyle(tag: string): TagStyle {
  const overrideKey = colorOverrides[tag]
  if (overrideKey) {
    const style = COLOR_KEY_TO_STYLE[overrideKey]
    if (style) return style
  }
  return DEFAULT_TAG_STYLE
}
