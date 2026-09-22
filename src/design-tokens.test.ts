import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// The shape of the token contract, read from the stylesheets as text. Colour
// values are not asserted here; the appearance baseline holds those.

const SRC = join(process.cwd(), 'src')
const appCss = readFileSync(join(SRC, 'index.css'), 'utf8')

function declarations(block: string): Record<string, string> {
  return Object.fromEntries(
    Array.from(block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g), (match) => [match[1], match[2].trim()]),
  )
}

/** The text between the braces that follow `selector`, brace depth respected. */
function blockAfter(selector: string, from = 0): { body: string; start: number; end: number } {
  const start = appCss.indexOf(selector, from)
  expect(start, `${selector} block`).toBeGreaterThan(-1)
  const open = appCss.indexOf('{', start)
  let depth = 0
  for (let i = open; i < appCss.length; i += 1) {
    if (appCss[i] === '{') depth += 1
    if (appCss[i] === '}') depth -= 1
    if (depth === 0) return { body: appCss.slice(open + 1, i), start, end: i + 1 }
  }
  throw new Error(`unterminated ${selector} block`)
}

const lightBlock = blockAfter(':root,\n[data-theme="light"]')
const darkBlock = blockAfter('[data-theme="dark"] {')
const aliasBlock = blockAfter('\n:root {', darkBlock.end)
const bridgeBlock = blockAfter('@theme inline')

const light = declarations(lightBlock.body)
const dark = declarations(darkBlock.body)
const aliases = declarations(aliasBlock.body)

const SHADCN_NAMES = [
  'background', 'foreground', 'card', 'card-foreground', 'popover', 'popover-foreground',
  'primary', 'primary-foreground', 'secondary', 'secondary-foreground', 'muted', 'muted-foreground',
  'accent', 'accent-foreground', 'destructive', 'destructive-foreground', 'border', 'input', 'ring',
]

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(tsx?|css)$/.test(entry) ? [path] : []
  })
}

describe('the theme blocks', () => {
  it('declare exactly the same names in light and in dark', () => {
    expect(Object.keys(light).length).toBeGreaterThan(0)
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort())
  })
})

describe('the shadcn aliases', () => {
  it('are the nineteen names, each a var() of a semantic name and nothing else', () => {
    expect(Object.keys(aliases).map((name) => name.slice(2)).sort()).toEqual([...SHADCN_NAMES].sort())
    for (const [name, value] of Object.entries(aliases)) {
      expect(value, name).toMatch(/^var\(--[\w-]+\)$/)
      expect(light, `${name} points at a declared token`).toHaveProperty(value.slice(4, -1))
    }
  })

  it('appear nowhere in src/ outside ui/, in any form, the bridged `--color-*` spelling included', () => {
    const names = SHADCN_NAMES.join('|')
    const asVariable = new RegExp(`var\\(--(?:color-)?(${names})\\)`)
    // A colour utility built on one of the names, with or without variants and an
    // opacity modifier, terminated so that `border-border-default` and `text-text-primary` do not match.
    // `shadow-card` is Plumo's own shadow token (`--shadow-card`), not the `card` alias.
    const shadowNames = SHADCN_NAMES.filter((name) => name !== 'card').join('|')
    const asUtility = new RegExp(`(?:^|[\\s"'\`(:])(?:[\\w[\\]=-]+:)*(?:(?:bg|text|border|ring|outline|fill|stroke|divide|placeholder|from|to|via|decoration|caret)-(${names})|shadow-(${shadowNames}))(?:/\\d+)?(?=[\\s"'\`)\\]/]|$)`, 'm')
    const offenders: string[] = []
    for (const file of sourceFiles(SRC)) {
      const path = relative(SRC, file)
      if (path.startsWith('ui/')) continue
      let text = readFileSync(file, 'utf8')
      if (path === 'index.css') {
        // The alias block and the bridge are where the names are defined; the rest of the file is scanned.
        text = text.slice(0, aliasBlock.start) + text.slice(aliasBlock.end, bridgeBlock.start) + text.slice(bridgeBlock.end)
      }
      const hit = text.match(asVariable) ?? text.match(asUtility)
      if (hit) offenders.push(`${path}: ${hit[0].trim()}`)
    }
    expect(offenders).toEqual([])
  })
})

describe('literal colours', () => {
  it('appear only inside the two theme blocks', () => {
    const literal = /#[0-9a-f]{3,8}\b|rgba?\(/i
    const checks: Array<[string, string]> = [
      ['index.css', appCss.slice(0, lightBlock.start) + appCss.slice(lightBlock.end, darkBlock.start) + appCss.slice(darkBlock.end)],
      ['kernel/blocknote/blocknote.css', readFileSync(join(SRC, 'kernel', 'blocknote', 'blocknote.css'), 'utf8')],
    ]
    for (const [name, text] of checks) {
      const hit = text.match(literal)
      expect(hit ? `${name}: ${hit[0]}` : null).toBeNull()
    }
  })
})
