import { describe, expect, it, vi } from 'vitest'
import { htmlFilePreviewSrcDoc } from './htmlFilePreview'

const convertFileSrc = vi.fn((path: string) => `asset://localhost/${encodeURIComponent(path)}`)

describe('htmlFilePreviewSrcDoc', () => {
  it('renders styled HTML while removing active content', () => {
    const srcDoc = htmlFilePreviewSrcDoc({
      content: `<!doctype html>
        <html>
          <head><style>body { color: rebeccapurple; }</style></head>
          <body onclick="steal()">
            <h1>Safe report</h1>
            <script>window.parent.__TAURI_INTERNALS__.invoke('danger')</script>
            <iframe src="https://example.com"></iframe>
            <form action="https://example.com"><input name="secret"></form>
          </body>
        </html>`,
      filePath: '/vault/reports/status.html',
      vaultPath: '/vault',
      convertFileSrc,
    })

    expect(srcDoc).toContain('Safe report')
    expect(srcDoc).toContain('color: rebeccapurple')
    expect(srcDoc).not.toContain('<script')
    expect(srcDoc).not.toContain('<iframe')
    expect(srcDoc).not.toContain('<form')
    expect(srcDoc).not.toContain('onclick')
    expect(srcDoc).toContain("script-src 'none'")
    expect(srcDoc).toContain("connect-src 'none'")
    expect(srcDoc).toContain("form-action 'none'")
  })

  it('rewrites vault-local resources and strips remote passive loads', () => {
    const srcDoc = htmlFilePreviewSrcDoc({
      content: `
        <link rel="stylesheet" href="./styles/report.css">
        <style>.hero { background: url('../images/hero.png'); }</style>
        <img src="./charts/velocity.svg" srcset="./charts/small.png 1x, ./charts/large.png 2x">
        <img src="https://tracker.example/pixel.gif">
      `,
      filePath: '/vault/reports/status.html',
      vaultPath: '/vault',
      convertFileSrc,
    })

    expect(srcDoc).toContain('asset://localhost/%2Fvault%2Freports%2Fstyles%2Freport.css')
    expect(srcDoc).toContain('asset://localhost/%2Fvault%2Freports%2Fcharts%2Fvelocity.svg')
    expect(srcDoc).toContain('asset://localhost/%2Fvault%2Fimages%2Fhero.png')
    expect(srcDoc).toContain('asset://localhost/%2Fvault%2Freports%2Fcharts%2Fsmall.png 1x')
    expect(srcDoc).not.toContain('tracker.example')
  })

  it('refuses relative resources that escape the active vault', () => {
    const srcDoc = htmlFilePreviewSrcDoc({
      content: '<img src="../../../private/secret.png">',
      filePath: '/vault/reports/status.html',
      vaultPath: '/vault',
      convertFileSrc,
    })

    expect(srcDoc).not.toContain('secret.png')
  })
})
