import { describe, expect, it } from 'vitest'
import { formatSavedLabel } from './path-row-saved-label'

describe('formatSavedLabel', () => {
  it('reads "saved just now" within the first second', () => {
    expect(formatSavedLabel(10_000, 10_400)).toBe('saved just now')
  })

  it('counts seconds under a minute', () => {
    expect(formatSavedLabel(10_000, 12_000)).toBe('saved 2s ago')
    expect(formatSavedLabel(10_000, 69_999)).toBe('saved 59s ago')
  })

  it('counts minutes under an hour', () => {
    expect(formatSavedLabel(0, 60_000)).toBe('saved 1m ago')
    expect(formatSavedLabel(0, 59 * 60_000 + 30_000)).toBe('saved 59m ago')
  })

  it('counts hours beyond that', () => {
    expect(formatSavedLabel(0, 3 * 3_600_000 + 5_000)).toBe('saved 3h ago')
  })

  it('never reads negative when the clock skews backwards', () => {
    expect(formatSavedLabel(10_000, 9_000)).toBe('saved just now')
  })
})
