import { describe, it, expect } from 'vitest'
import { resolveIcon, ICON_OPTIONS } from './iconRegistry'
import { FileText } from '@phosphor-icons/react'

describe('resolveIcon', () => {
  it('returns FileText for null', () => {
    expect(resolveIcon(null)).toBe(FileText)
  })

  it('returns FileText for unknown icon name', () => {
    expect(resolveIcon('nonexistent-icon')).toBe(FileText)
  })

  it('resolves gear-six to GearSix', () => {
    expect(resolveIcon('gear-six')).not.toBe(FileText)
  })

  it('resolves cooking-pot to CookingPot', () => {
    expect(resolveIcon('cooking-pot')).not.toBe(FileText)
  })

  it('resolves icons outside the former curated set', () => {
    expect(resolveIcon('air-traffic-control')).not.toBe(FileText)
  })
})

describe('ICON_OPTIONS', () => {
  it('includes gear-six', () => {
    expect(ICON_OPTIONS.some((o) => o.name === 'gear-six')).toBe(true)
  })

  it('exposes every unique icon export in stable name order', () => {
    const names = ICON_OPTIONS.map((option) => option.name)

    expect(names).toHaveLength(1_530)
    expect(new Set(names).size).toBe(names.length)
    expect(names).toEqual([...names].sort((left, right) => left.localeCompare(right)))
  })

  it('omits duplicate Icon aliases and non-icon infrastructure exports', () => {
    const names = new Set(ICON_OPTIONS.map((option) => option.name))

    expect(names.has('acorn')).toBe(true)
    expect(names.has('acorn-icon')).toBe(false)
    expect(names.has('icon-context')).toBe(false)
    expect(names.has('ssr-base')).toBe(false)
  })
})
