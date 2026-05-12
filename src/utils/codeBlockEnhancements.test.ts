import { afterEach, describe, expect, it } from 'vitest'
import {
  handleCodeBlockSelectAll,
  installCodeBlockEnhancements,
  lineNumbersForText,
} from './codeBlockEnhancements'

function renderCodeBlock(code: string): HTMLElement {
  document.body.innerHTML = `
    <div class="editor__blocknote-container">
      <div class="bn-block-content" data-content-type="codeBlock">
        <pre><code>${code}</code></pre>
      </div>
      <p>Outside text</p>
    </div>
  `

  return document.querySelector<HTMLElement>('pre code')!
}

function placeSelectionInside(element: HTMLElement): void {
  const range = document.createRange()
  range.setStart(element, 0)
  range.collapse(true)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

describe('codeBlockEnhancements', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    window.getSelection()?.removeAllRanges()
  })

  it('builds one line number per source line', () => {
    expect(lineNumbersForText('const a = 1\nconst b = 2\n')).toBe('1\n2')
  })

  it('keeps select-all scoped to the active code block', () => {
    const code = renderCodeBlock('const a = 1\nconsole.log(a)')
    placeSelectionInside(code)

    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'a',
      metaKey: true,
    })

    expect(handleCodeBlockSelectAll(event, document)).toBe(true)
    expect(event.defaultPrevented).toBe(true)
    expect(window.getSelection()?.toString()).toBe('const a = 1\nconsole.log(a)')
  })

  it('ignores select-all outside editor code blocks', () => {
    document.body.innerHTML = '<p>Outside text</p>'
    placeSelectionInside(document.querySelector('p')!)

    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'a',
      metaKey: true,
    })

    expect(handleCodeBlockSelectAll(event, document)).toBe(false)
    expect(event.defaultPrevented).toBe(false)
  })

  it('installs a document listener for scoped select-all', () => {
    const code = renderCodeBlock('one\ntwo')
    const cleanup = installCodeBlockEnhancements(document)
    placeSelectionInside(code)

    document.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'a',
      metaKey: true,
    }))

    expect(window.getSelection()?.toString()).toBe('one\ntwo')

    cleanup()
  })
})
