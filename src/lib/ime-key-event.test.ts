import { describe, expect, it } from 'vitest'
import { isImeKeyEvent } from './ime-key-event'

describe('isImeKeyEvent', () => {
  it('is true while a composition is open', () => {
    expect(isImeKeyEvent({ isComposing: true, keyCode: 13 })).toBe(true)
  })

  it('is true for the key that ends a composition in WKWebView: no longer composing, still keyCode 229', () => {
    expect(isImeKeyEvent({ isComposing: false, keyCode: 229 })).toBe(true)
  })

  it('is false for a plain key', () => {
    expect(isImeKeyEvent({ isComposing: false, keyCode: 13 })).toBe(false)
  })
})
