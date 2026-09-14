import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { THEME_MODE_STORAGE_KEY } from './theme-mode'
import { useAppearance } from './use-appearance'
import { useThemeMode } from './use-theme-mode'

/** The shell's wiring: the choice is painted once the Session has been restored. */
function useShellAppearance(restored: boolean) {
  const appearance = useAppearance()
  useThemeMode(appearance.themeMode, restored)
  return appearance
}

function installMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    })),
  })
}

describe('use-appearance', () => {
  beforeEach(() => {
    installMatchMedia(false)
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.classList.remove('dark')
  })

  it('is dark until the Session has been restored, then applies dark', () => {
    const { result, rerender } = renderHook(({ restored }) => useShellAppearance(restored), {
      initialProps: { restored: false },
    })

    expect(result.current.themeMode).toBe('dark')
    expect(document.documentElement).not.toHaveAttribute('data-theme')

    rerender({ restored: true })

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).toHaveClass('dark')
  })

  it('applies the appearance the Session restores', () => {
    const { result } = renderHook(() => useShellAppearance(true))

    act(() => result.current.restoreTheme('light'))

    expect(result.current.themeMode).toBe('light')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('switches through the View → Appearance commands and mirrors the choice for the pre-paint script', () => {
    const { result } = renderHook(() => useShellAppearance(true))

    act(() => result.current.handlers.onAppearanceLight())
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')

    act(() => result.current.handlers.onAppearanceSystem())
    expect(result.current.themeMode).toBe('system')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(window.localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('system')

    act(() => result.current.handlers.onAppearanceDark())
    expect(result.current.themeMode).toBe('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })
})
