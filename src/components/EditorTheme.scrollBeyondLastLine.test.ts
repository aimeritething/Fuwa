import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readComponentCss(filename: string) {
  return readFileSync(`${process.cwd()}/src/components/${filename}`, 'utf8')
}

describe('rich editor scroll-beyond-last-line space', () => {
  it('reserves half of the viewport after the BlockNote document', () => {
    expect(readComponentCss('EditorTheme.css')).toMatch(
      /\.editor__blocknote-container \.bn-editor\s*\{[^}]*padding-bottom:\s*max\(var\(--editor-padding-vertical\),\s*50vh\)/s,
    )
  })

  it('removes the visual-only space from note PDF exports', () => {
    expect(readComponentCss('Editor.css')).toMatch(
      /body\.tolaria-note-pdf-exporting \.bn-editor\s*\{[^}]*padding:\s*0 !important/s,
    )
  })
})
