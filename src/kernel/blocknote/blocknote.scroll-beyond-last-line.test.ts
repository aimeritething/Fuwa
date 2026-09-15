import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const blocknoteCss = readFileSync('src/kernel/blocknote/blocknote.css', 'utf8')

describe('rich editor scroll-beyond-last-line space', () => {
  it('reserves half of the viewport after the BlockNote document', () => {
    expect(blocknoteCss).toMatch(
      /\.bn-editor\s*\{[^}]*padding-bottom:\s*max\(var\(--editor-padding-vertical\),\s*50vh\)/s,
    )
  })
})
