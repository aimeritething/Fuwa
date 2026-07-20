import { describe, expect, it, vi } from 'vitest'
import {
  installCodeBlockLineNumbers,
  syncCodeBlockLineNumbers,
} from './codeBlockLineNumbers'

function codeBlock(text: string) {
  const block = document.createElement('div')
  block.dataset.contentType = 'codeBlock'
  const pre = document.createElement('pre')
  const code = document.createElement('code')
  code.textContent = text
  pre.appendChild(code)
  block.appendChild(pre)
  return { block, code, pre }
}

describe('code block line numbers', () => {
  it('renders one non-editable gutter row per logical line', () => {
    const root = document.createElement('div')
    const layer = document.createElement('div')
    const fixture = codeBlock('one\ntwo\nthree')
    root.appendChild(fixture.block)

    syncCodeBlockLineNumbers(root, layer)

    const gutter = layer.querySelector('[data-code-line-numbers]')
    expect(gutter).toHaveAttribute('contenteditable', 'false')
    expect(gutter).toHaveTextContent('123')
    expect(gutter?.children).toHaveLength(3)
    expect(fixture.code.textContent).toBe('one\ntwo\nthree')
  })

  it('updates the gutter without duplicating it when code changes', async () => {
    const root = document.createElement('div')
    const host = document.createElement('div')
    const fixture = codeBlock('one')
    root.appendChild(fixture.block)
    host.appendChild(root)
    const controller = new AbortController()

    installCodeBlockLineNumbers(root, controller.signal)
    fixture.code.textContent = 'one\ntwo'
    await vi.waitFor(() => {
      expect(host.querySelectorAll('[data-code-line-numbers]')).toHaveLength(1)
      expect(host.querySelector('[data-code-line-numbers]')?.children).toHaveLength(2)
    })

    controller.abort()
    expect(host.querySelector('[data-code-line-numbers]')).toBeNull()
  })

  it('positions every number from the rendered line start without accumulating wrap errors', () => {
    const root = document.createElement('div')
    const layer = document.createElement('div')
    const fixture = codeBlock('one\ntwo\nthree')
    root.appendChild(fixture.block)
    vi.spyOn(fixture.pre, 'getBoundingClientRect').mockReturnValue({
      bottom: 180,
      height: 80,
      left: 0,
      right: 100,
      top: 100,
      width: 100,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    })
    vi.spyOn(document, 'createRange').mockImplementation(() => {
      let startOffset = 0
      return {
        collapse: vi.fn(),
        getClientRects: () => [{ top: new Map([[0, 100], [4, 140], [8, 160]]).get(startOffset) ?? 100 }],
        setEnd: vi.fn(),
        setStart: vi.fn((_node: Node, offset: number) => { startOffset = offset }),
      } as unknown as Range
    })

    syncCodeBlockLineNumbers(root, layer)

    const numbers = layer.querySelectorAll<HTMLElement>('[data-code-line-numbers] > span')
    expect(Array.from(numbers, (number) => number.style.top)).toEqual(['0px', '40px', '60px'])
    expect(layer.querySelector<HTMLElement>('[data-code-line-numbers]')?.style.height).toBe('80px')
  })
})
