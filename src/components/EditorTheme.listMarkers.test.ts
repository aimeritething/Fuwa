import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const editorThemeCss = readFileSync('src/components/EditorTheme.css', 'utf8')

describe('editor list marker typography', () => {
  it('derives marker size from editor text so it scales with zoom', () => {
    const normalizedCss = editorThemeCss.replace(/\s+/g, ' ')

    expect(editorThemeCss).toMatch(
      /\[data-content-type="bulletListItem"\]\s*\{[^}]*--lists-marker-radius:\s*calc\(var\(--editor-font-size\)\s*\*\s*0\.2\)\s*;[^}]*--lists-marker-size:\s*calc\(var\(--editor-font-size\)\s*\*\s*0\.4\)\s*;/s,
    )
    expect(normalizedCss).toContain(
      'background: radial-gradient( circle, var(--lists-bullet-color) 0 var(--lists-marker-radius), transparent var(--lists-marker-fade-radius) );',
    )
  })

  it('uses distinct hollow-circle and square markers for nested bullets', () => {
    const normalizedCss = editorThemeCss.replace(/\s+/g, ' ')

    expect(normalizedCss).toContain(
      '.bn-block-group .bn-block-group [data-content-type="bulletListItem"]::before { background: radial-gradient( circle, transparent 0 var(--lists-marker-inner-radius), var(--lists-bullet-color) var(--lists-marker-inner-radius) var(--lists-marker-radius), transparent var(--lists-marker-fade-radius) );',
    )
    expect(normalizedCss).toContain(
      '.bn-block-group .bn-block-group .bn-block-group [data-content-type="bulletListItem"]::before { background: linear-gradient(var(--lists-bullet-color), var(--lists-bullet-color)) center / var(--lists-marker-size) var(--lists-marker-size) no-repeat;',
    )
  })
})
