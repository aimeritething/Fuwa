import { describe, expect, it } from 'vitest'
import { tabParentHints } from './tab-labels'

describe('tabParentHints', () => {
  it('gives each Tab that shares its file name its parent folder name', () => {
    const hints = tabParentHints(['/n/Chinese/Everything.md', '/n/Welcome.md', '/n/English/Everything.md'])

    expect(hints.get('/n/Chinese/Everything.md')).toBe('Chinese')
    expect(hints.get('/n/English/Everything.md')).toBe('English')
  })

  it('gives a Tab whose name is its own nothing', () => {
    const hints = tabParentHints(['/n/Chinese/Everything.md', '/n/Welcome.md', '/n/English/Everything.md'])

    expect(hints.has('/n/Welcome.md')).toBe(false)
    expect(tabParentHints(['/n/a.md', '/n/b.md']).size).toBe(0)
  })

  it('tells an Image file apart the same way', () => {
    const hints = tabParentHints(['/n/Attachments/lake.png', '/n/images/lake.png'])

    expect([...hints.values()]).toEqual(['Attachments', 'images'])
  })
})
