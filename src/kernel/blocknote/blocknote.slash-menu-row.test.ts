import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// BlockNote's shadcn SuggestionMenu.Item repeats the row's className on its
// icon cell, its title and its subtitle. A rule keyed on the bare class lands
// on all four: the title and the empty subtitle each take the row height and
// the titles overflow into the rows below.

const blocknoteCss = readFileSync(join(process.cwd(), 'src', 'kernel/blocknote/blocknote.css'), 'utf8')

describe('the slash menu row rule', () => {
  it('keys the row geometry on the option role, not on the class the adapter repeats inside', () => {
    expect(blocknoteCss).toContain('.bn-suggestion-menu-item[role="option"],')
    expect(blocknoteCss).not.toMatch(/^\s*\.bn-suggestion-menu-item,\s*$/m)
    expect(blocknoteCss).not.toMatch(/^\s*\.bn-suggestion-menu-item:is\(/m)
  })

  it('takes the row geometry back off the inner elements that carry the row class', () => {
    expect(blocknoteCss).toContain('.bn-suggestion-menu-item[role="option"] .bn-suggestion-menu-item {')
    expect(blocknoteCss).toContain('.bn-suggestion-menu-item[role="option"] .bn-suggestion-menu-item:empty {')
  })
})
