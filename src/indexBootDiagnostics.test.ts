import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function firstInlineScriptFromIndex(): string {
  const indexHtml = readFileSync(`${process.cwd()}/index.html`, 'utf8')
  const match = indexHtml.match(/<script>\s*([\s\S]*?)\s*<\/script>/)
  if (!match) throw new Error('index.html boot diagnostics script was not found')
  return match[1]
}

describe('index boot diagnostics', () => {
  it('does not show the boot overlay for ResizeObserver loop notifications', () => {
    document.body.innerHTML = '<pre id="tolaria-boot-diagnostics">Tolaria boot: HTML parsed</pre>'
    new Function(firstInlineScriptFromIndex())()

    const event = new ErrorEvent('error', {
      cancelable: true,
      message: 'ResizeObserver loop completed with undelivered notifications.',
    })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(document.getElementById('tolaria-boot-diagnostics')?.textContent).toBe('Tolaria boot: HTML parsed')
  })

  it('still shows the boot overlay for real startup errors', () => {
    document.body.innerHTML = '<pre id="tolaria-boot-diagnostics">Tolaria boot: HTML parsed</pre>'
    new Function(firstInlineScriptFromIndex())()

    window.dispatchEvent(new ErrorEvent('error', {
      message: 'startup failed',
      filename: 'app.js',
      lineno: 1,
      colno: 2,
    }))

    expect(document.getElementById('tolaria-boot-diagnostics')?.textContent).toContain(
      'error: startup failed @ app.js:1:2',
    )
  })
})
