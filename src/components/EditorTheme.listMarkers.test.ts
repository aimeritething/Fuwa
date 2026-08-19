import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const editorThemeCss = readFileSync('src/components/EditorTheme.css', 'utf8')

describe('editor list marker typography', () => {
  it('keeps bullet glyphs on the pre-bundled system font metrics', () => {
    expect(editorThemeCss).toMatch(
      /\[data-content-type="bulletListItem"\]::before\s*\{[^}]*font-family:\s*-apple-system,\s*BlinkMacSystemFont,\s*sans-serif\s*;/s,
    )
  })
})
