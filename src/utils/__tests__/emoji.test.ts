import { describe, it, expect } from 'vitest'
import { isEmoji } from '../emoji'

describe('isEmoji', () => {
  it('returns true for common emoji', () => {
    expect(isEmoji('🎯')).toBe(true)
    expect(isEmoji('🔥')).toBe(true)
    expect(isEmoji('🚀')).toBe(true)
    expect(isEmoji('❤️')).toBe(true)
    expect(isEmoji('✨')).toBe(true)
  })

  it('returns false for Phosphor icon names', () => {
    expect(isEmoji('cooking-pot')).toBe(false)
    expect(isEmoji('file-text')).toBe(false)
    expect(isEmoji('rocket')).toBe(false)
    expect(isEmoji('star')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isEmoji('')).toBe(false)
  })

  it('returns false for regular text', () => {
    expect(isEmoji('hello')).toBe(false)
    expect(isEmoji('ABC')).toBe(false)
    expect(isEmoji('123')).toBe(false)
  })

  it('handles compound emoji (ZWJ sequences)', () => {
    expect(isEmoji('👨‍💻')).toBe(true)
    expect(isEmoji('🧑‍🔬')).toBe(true)
  })

  it('returns false for multi-emoji strings', () => {
    expect(isEmoji('🔥🚀')).toBe(false)
    expect(isEmoji('hi 🎯')).toBe(false)
  })
})
