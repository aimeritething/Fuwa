import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The app stylesheet carries Linear's default theme-generator output,
// re-valued in place. Expected values are the hex values of that output,
// read from the stylesheet as text so the contract
// is checked without a browser.

const appCss = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8')

function declarations(block: string): Record<string, string> {
  return Object.fromEntries(
    Array.from(block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g), (match) => [match[1], match[2].trim()]),
  )
}

function themeBlock(selector: string): Record<string, string> {
  const start = appCss.indexOf(selector)
  expect(start, `${selector} block`).toBeGreaterThan(-1)
  const open = appCss.indexOf('{', start)
  let depth = 0
  for (let i = open; i < appCss.length; i += 1) {
    if (appCss[i] === '{') depth += 1
    if (appCss[i] === '}') depth -= 1
    if (depth === 0) return declarations(appCss.slice(open, i))
  }
  throw new Error(`unterminated ${selector} block`)
}

const light = themeBlock(':root,\n[data-theme="light"]')
const dark = themeBlock(':root.dark,\n[data-theme="dark"]')

describe('Linear design tokens (dark)', () => {
  it('paints the canvas and sidebar on the sidebar sub-theme and the card on the base theme', () => {
    expect(dark['--surface-app']).toBe('#09090a')
    expect(dark['--surface-sidebar']).toBe('#09090a')
    expect(dark['--surface-card']).toBe('#111212')
    expect(dark['--surface-editor']).toBe('#111212')
    expect(dark['--surface-popover']).toBe('#202022')
    expect(dark['--surface-overlay']).toBe('#00000066')
  })

  it('uses the label scale for text and the border colour for borders', () => {
    expect(dark['--text-heading']).toBe('#ffffff')
    expect(dark['--text-primary']).toBe('#e2e3e5')
    expect(dark['--text-secondary']).toBe('#949597')
    expect(dark['--text-faint']).toBe('#565658')
    expect(dark['--border-default']).toBe('#232325')
  })

  it('accents with indigo and links with the editor link colour', () => {
    expect(dark['--accent-blue']).toBe('#5e69d1')
    expect(dark['--accent-blue-hover']).toBe('#6974e1')
    expect(dark['--state-focus-ring']).toBe('#5e69d1')
    expect(dark['--link-color']).toBe('#adbbff')
  })

  it('carries the seven chromatic roles and the code highlighting colours', () => {
    expect(dark['--chroma-teal']).toBe('#00b8cb')
    expect(dark['--chroma-purple-text']).toBe('#adbaff')
    expect(dark['--syntax-highlight-keyword']).toBe('#e394dc')
    expect(dark['--syntax-highlight-string']).toBe('#00c5f0')
    expect(dark['--syntax-highlight-title']).toBe('#25f8ca')
    expect(dark['--syntax-highlight-attr']).toBe('#fce27d')
    expect(dark['--syntax-highlight-number']).toBe('#ec3b40')
    expect(dark['--syntax-highlight-comment']).toBe('var(--text-faint)')
  })
})

describe('Linear design tokens (light)', () => {
  it('matches the light generator output', () => {
    expect(light['--surface-app']).toBe('#eeeeef')
    expect(light['--surface-sidebar']).toBe('#eeeeef')
    expect(light['--surface-card']).toBe('#f8f8f9')
    expect(light['--surface-popover']).toBe('#ffffff')
    expect(light['--text-heading']).toBe('#1b1b1b')
    expect(light['--text-primary']).toBe('#2f2f31')
    expect(light['--text-secondary']).toBe('#5b5c5e')
    expect(light['--border-default']).toBe('#dedede')
    expect(light['--link-color']).toBe('#3f60d9')
  })
})

describe('shared tokens', () => {
  it('sets the shadcn radius to 8px so md is 6px', () => {
    expect(light['--radius']).toBe('8px')
  })

  it('defines the hairline at 1px, and 0.5px on HiDPI', () => {
    expect(light['--hairline']).toBe('1px')
    expect(appCss).toMatch(/@media[^{]*min-resolution:\s*2dppx[^{]*\{\s*:root\s*\{\s*--hairline:\s*0\.5px;/)
  })

  it("keeps every variable the kernel's stylesheet declared, in both scopes", () => {
    for (const name of ['--surface-app', '--text-tertiary', '--state-hover-subtle', '--accent-pink-light', '--syntax-frontmatter-key', '--editor-code-block-language', '--bg-primary', '--sidebar-ring']) {
      expect(light, name).toHaveProperty(name)
      expect(dark, name).toHaveProperty(name)
    }
  })

  it('loads Inter Variable and JetBrains Mono only, with no acid lime anywhere', () => {
    expect(appCss).toMatch(/font-family:\s*'Inter Variable'/)
    expect(appCss).not.toMatch(/IBM Plex/i)
    expect(appCss).not.toMatch(/e4f222/i)
  })
})
