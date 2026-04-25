import { readFileSync } from 'node:fs'

describe('Tauri Content Security Policy', () => {
  it('keeps broad inline styles available when runtime libraries inject style tags', () => {
    const config = JSON.parse(readFileSync(`${process.cwd()}/src-tauri/tauri.conf.json`, 'utf8'))
    const styleSrc = config.app.security.csp['style-src'] as string

    expect(styleSrc).toContain("'unsafe-inline'")
    expect(styleSrc).not.toMatch(/'nonce-|sha(256|384|512)-/)
  })
})
