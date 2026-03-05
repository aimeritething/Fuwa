import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ThemePropertyEditor } from './ThemePropertyEditor'
import type { ThemeManager } from '../hooks/useThemeManager'

function makeThemeManager(overrides: Partial<ThemeManager> = {}): ThemeManager {
  return {
    themes: [],
    activeThemeId: '/vault/_themes/My Theme.md',
    activeTheme: { id: '/vault/_themes/My Theme.md', name: 'My Theme', description: '', colors: {}, typography: {}, spacing: {} },
    activeThemeContent: '---\nIs A: Theme\nName: My Theme\neditor-font-size: 18px\nlists-bullet-color: "#ff0000"\n---\n',
    isDark: false,
    switchTheme: vi.fn(),
    createTheme: vi.fn().mockResolvedValue(''),
    reloadThemes: vi.fn(),
    updateThemeProperty: vi.fn(),
    ...overrides,
  }
}

describe('ThemePropertyEditor', () => {
  it('shows message when no theme is active', () => {
    const tm = makeThemeManager({ activeThemeId: null })
    render(<ThemePropertyEditor themeManager={tm} />)
    expect(screen.getByText(/Select a theme/)).toBeInTheDocument()
  })

  it('renders the editor when a theme is active', () => {
    const tm = makeThemeManager()
    render(<ThemePropertyEditor themeManager={tm} />)
    expect(screen.getByTestId('theme-property-editor')).toBeInTheDocument()
  })

  it('shows section headers for all theme.json sections', () => {
    const tm = makeThemeManager()
    render(<ThemePropertyEditor themeManager={tm} />)
    expect(screen.getByText('Typography')).toBeInTheDocument()
    expect(screen.getByText('Headings')).toBeInTheDocument()
    expect(screen.getByText('Lists')).toBeInTheDocument()
    expect(screen.getByText('Code Blocks')).toBeInTheDocument()
    expect(screen.getByText('Blockquote')).toBeInTheDocument()
    expect(screen.getByText('Table')).toBeInTheDocument()
    expect(screen.getByText('Horizontal Rule')).toBeInTheDocument()
    expect(screen.getByText('Colors')).toBeInTheDocument()
  })

  it('shows active theme name', () => {
    const tm = makeThemeManager()
    render(<ThemePropertyEditor themeManager={tm} />)
    expect(screen.getByText('My Theme')).toBeInTheDocument()
  })

  it('expands Typography section by default', () => {
    const tm = makeThemeManager()
    render(<ThemePropertyEditor themeManager={tm} />)
    // Typography section should be expanded, showing its properties
    expect(screen.getByTestId('theme-input-editor-font-size')).toBeInTheDocument()
  })

  it('shows current theme value for overridden properties', () => {
    const tm = makeThemeManager()
    render(<ThemePropertyEditor themeManager={tm} />)
    const fontSizeInput = screen.getByTestId('theme-input-editor-font-size') as HTMLInputElement
    expect(fontSizeInput.value).toBe('18')
  })

  it('shows default value for non-overridden properties', () => {
    const tm = makeThemeManager()
    render(<ThemePropertyEditor themeManager={tm} />)
    // editor-max-width is not in the theme content, so it should show the default (720)
    const maxWidthInput = screen.getByTestId('theme-input-editor-max-width') as HTMLInputElement
    expect(maxWidthInput.value).toBe('720')
  })

  it('calls updateThemeProperty on number input change', async () => {
    vi.useFakeTimers()
    const updateFn = vi.fn()
    const tm = makeThemeManager({ updateThemeProperty: updateFn })
    render(<ThemePropertyEditor themeManager={tm} />)
    const fontSizeInput = screen.getByTestId('theme-input-editor-font-size') as HTMLInputElement
    fireEvent.change(fontSizeInput, { target: { value: '16' } })

    // Debounce fires after 300ms
    act(() => { vi.advanceTimersByTime(300) })
    expect(updateFn).toHaveBeenCalledWith('editor-font-size', '16px')
    vi.useRealTimers()
  })

  it('expands collapsed sections on click', () => {
    const tm = makeThemeManager()
    render(<ThemePropertyEditor themeManager={tm} />)
    // Lists section should be collapsed by default
    expect(screen.queryByTestId('theme-input-lists-bullet-size')).not.toBeInTheDocument()

    // Click to expand
    fireEvent.click(screen.getByTestId('theme-section-lists-toggle'))
    expect(screen.getByTestId('theme-input-lists-bullet-size')).toBeInTheDocument()
  })

  it('toggles section via keyboard Enter', () => {
    const tm = makeThemeManager()
    render(<ThemePropertyEditor themeManager={tm} />)
    const toggle = screen.getByTestId('theme-section-lists-toggle')
    fireEvent.keyDown(toggle, { key: 'Enter' })
    expect(screen.getByTestId('theme-input-lists-bullet-size')).toBeInTheDocument()
  })

  it('toggles section via keyboard Space', () => {
    const tm = makeThemeManager()
    render(<ThemePropertyEditor themeManager={tm} />)
    const toggle = screen.getByTestId('theme-section-lists-toggle')
    fireEvent.keyDown(toggle, { key: ' ' })
    expect(screen.getByTestId('theme-input-lists-bullet-size')).toBeInTheDocument()
  })

  it('shows heading subsections after expanding Headings', () => {
    const tm = makeThemeManager()
    render(<ThemePropertyEditor themeManager={tm} />)
    fireEvent.click(screen.getByTestId('theme-section-headings-toggle'))
    expect(screen.getByText('Heading 1')).toBeInTheDocument()
    expect(screen.getByText('Heading 2')).toBeInTheDocument()
    expect(screen.getByText('Heading 3')).toBeInTheDocument()
    expect(screen.getByText('Heading 4')).toBeInTheDocument()
  })

  it('shows unit label for numeric properties', () => {
    const tm = makeThemeManager()
    render(<ThemePropertyEditor themeManager={tm} />)
    // "px" should appear near Font Size input
    const container = screen.getByTestId('theme-input-editor-font-size').parentElement!
    expect(container.textContent).toContain('px')
  })
})
