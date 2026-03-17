import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getTagStyle,
  getTagColorKey,
  setTagColor,
  DEFAULT_TAG_STYLE,
  initTagColors,
} from './tagStyles'
import { bindVaultConfigStore, getVaultConfig, resetVaultConfigStore } from './vaultConfigStore'

describe('tagStyles — color overrides', () => {
  beforeEach(() => {
    resetVaultConfigStore()
    bindVaultConfigStore(
      { zoom: null, view_mode: null, editor_mode: null, tag_colors: null, status_colors: null, property_display_modes: null },
      vi.fn(),
    )
    // Reset module-level cache
    initTagColors({})
  })

  it('returns default style when no override exists', () => {
    expect(getTagStyle('SomeTag')).toEqual(DEFAULT_TAG_STYLE)
  })

  it('getTagColorKey returns null when no override set', () => {
    expect(getTagColorKey('React')).toBeNull()
  })

  it('setTagColor persists a color override', () => {
    setTagColor('React', 'blue')
    expect(getTagColorKey('React')).toBe('blue')
    const stored = getVaultConfig().tag_colors as Record<string, string>
    expect(stored).toBeTruthy()
    expect(stored['React']).toBe('blue')
  })

  it('getTagStyle uses override when set', () => {
    setTagColor('React', 'green')
    const style = getTagStyle('React')
    expect(style.color).toBe('var(--accent-green)')
    expect(style.bg).toBe('var(--accent-green-light)')
  })

  it('setTagColor with null removes the override', () => {
    setTagColor('React', 'red')
    expect(getTagColorKey('React')).toBe('red')
    setTagColor('React', null)
    expect(getTagColorKey('React')).toBeNull()
    expect(getTagStyle('React')).toEqual(DEFAULT_TAG_STYLE)
  })

  it('applies different overrides for different tags', () => {
    setTagColor('React', 'blue')
    setTagColor('TypeScript', 'purple')
    expect(getTagStyle('React').color).toBe('var(--accent-blue)')
    expect(getTagStyle('TypeScript').color).toBe('var(--accent-purple)')
  })

  it('ignores invalid color key in override', () => {
    setTagColor('React', 'nonexistent-color')
    // Falls back to default since "nonexistent-color" isn't a valid ACCENT_COLOR key
    expect(getTagStyle('React')).toEqual(DEFAULT_TAG_STYLE)
  })

  it('persists multiple overrides to vault config', () => {
    setTagColor('React', 'blue')
    setTagColor('Tauri', 'orange')
    const stored = getVaultConfig().tag_colors as Record<string, string>
    expect(stored).toEqual({ React: 'blue', Tauri: 'orange' })
  })
})
