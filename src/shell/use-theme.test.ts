import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useEditorTheme } from './use-theme'

describe('useEditorTheme', () => {
  it('sets inline code on its own translucent surface without exporting code block overrides', () => {
    const { result } = renderHook(() => useEditorTheme())

    expect(result.current.cssVars['--inline-styles-code-background-color']).toBe(
      'var(--editor-inline-code-background)'
    )
    expect(result.current.cssVars['--inline-styles-code-font-size']).toBe('0.9375em')
    expect(result.current.cssVars['--inline-styles-code-border-radius']).toBe('0.2em')
    expect(result.current.cssVars['--code-blocks-background-color']).toBeUndefined()
  })

  it('sets the body at 15px / 1.6 / 450 with Linear\'s letter-spacing, in Inter Variable', () => {
    const { result } = renderHook(() => useEditorTheme())

    expect(result.current.cssVars['--editor-font-size']).toBe('15px')
    expect(result.current.cssVars['--editor-line-height']).toBe('1.6')
    expect(result.current.cssVars['--editor-font-weight']).toBe('450')
    expect(result.current.cssVars['--editor-letter-spacing']).toBe('-0.0067em')
    expect(result.current.cssVars['--editor-font-family']).toMatch(/^'Inter Variable'/)
    expect(result.current.cssVars['--inline-styles-code-font-family']).toMatch(/^'JetBrains Mono Variable'/)
  })

  it('sets the four headings at 22/19/17/15px with Linear\'s line heights and top margins, all 600', () => {
    const { result } = renderHook(() => useEditorTheme())
    const vars = result.current.cssVars

    expect([1, 2, 3, 4].map((level) => vars[`--headings-h${level}-font-size`])).toEqual(['22px', '19px', '17px', '15px'])
    expect([1, 2, 3, 4].map((level) => vars[`--headings-h${level}-line-height`])).toEqual(['29.6px', '28px', '24px', '24px'])
    expect([1, 2, 3, 4].map((level) => vars[`--headings-h${level}-margin-top`])).toEqual(['48px', '32px', '24px', '22px'])
    expect([1, 2, 3, 4].map((level) => vars[`--headings-h${level}-font-weight`])).toEqual(['600', '600', '600', '600'])
    expect([1, 2, 3, 4].map((level) => vars[`--headings-h${level}-color`])).toEqual(Array(4).fill('var(--text-heading)'))
  })

  it('draws the checkbox at 14px / radius 3, filled with the body colour when checked', () => {
    const { result } = renderHook(() => useEditorTheme())

    expect(result.current.cssVars['--checkboxes-size']).toBe('14px')
    expect(result.current.cssVars['--checkboxes-border-radius']).toBe('3px')
    expect(result.current.cssVars['--checkboxes-checked-color']).toBe('var(--text-primary)')
  })

  it('draws the blockquote bar at 4px, the rule at 1px, links in the link colour without an underline', () => {
    const { result } = renderHook(() => useEditorTheme())

    expect(result.current.cssVars['--blockquote-border-left-width']).toBe('4px')
    expect(result.current.cssVars['--horizontal-rule-thickness']).toBe('1px')
    expect(result.current.cssVars['--inline-styles-link-color']).toBe('var(--link-color)')
    expect(result.current.cssVars['--inline-styles-link-text-decoration']).toBe('none')
  })

  it('exports the editor column width: a 680px prose column plus 56px padding a side', () => {
    const { result } = renderHook(() => useEditorTheme())

    expect(result.current.cssVars['--editor-max-width']).toBe('792px')
    expect(result.current.cssVars['--editor-padding-horizontal']).toBe('56px')
  })
})
