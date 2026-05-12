import { afterEach, describe, expect, it, vi } from 'vitest'

const nativeRegExpDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'RegExp')
const NativeRegExp = RegExp

function setRegExpConstructor(value: RegExpConstructor) {
  Object.defineProperty(globalThis, 'RegExp', {
    configurable: true,
    writable: true,
    value,
  })
}

function restoreRegExpConstructor() {
  if (nativeRegExpDescriptor) {
    Object.defineProperty(globalThis, 'RegExp', nativeRegExpDescriptor)
  }
}

function installMockRegExp(shouldReject: (pattern: string | RegExp | undefined, flags: string | undefined) => boolean) {
  const LegacyWebKitRegExp = function (pattern?: string | RegExp, flags?: string) {
    if (shouldReject(pattern, flags)) {
      throw new SyntaxError('Invalid regular expression: invalid group specifier name')
    }

    return new NativeRegExp(pattern, flags)
  } as RegExpConstructor

  Object.setPrototypeOf(LegacyWebKitRegExp, NativeRegExp)
  LegacyWebKitRegExp.prototype = NativeRegExp.prototype

  setRegExpConstructor(LegacyWebKitRegExp)
}

function installLegacyWebKitRegExp() {
  installMockRegExp((_pattern, flags) => Boolean(flags?.includes('d') || flags?.includes('v')))
}

function installLookbehindMissingRegExp() {
  installMockRegExp((pattern) => typeof pattern === 'string' && pattern.includes('(?<'))
}

afterEach(() => {
  document.body.innerHTML = ''
  document.documentElement.classList.remove('dark')
  delete document.documentElement.dataset.theme
  restoreRegExpConstructor()
  vi.resetModules()
})

describe('editor schema code block highlighting', () => {
  it('renders one line number per code block source line', async () => {
    vi.resetModules()

    const { createTolariaCodeBlockSpec } = await import('./codeBlockOptions')
    const codeBlockSpec = createTolariaCodeBlockSpec()
    type Render = typeof codeBlockSpec.implementation.render
    type CodeBlock = Parameters<Render>[0]
    type CodeBlockEditor = Parameters<Render>[1]
    type RenderContext = ThisParameterType<Render>

    const block = {
      id: 'code-block-1',
      type: 'codeBlock',
      props: { language: 'text' },
      content: [{ type: 'text', text: 'const a = 1\nconsole.log(a)' }],
      children: [],
    } as CodeBlock
    const editor = {
      isEditable: true,
      getBlock: () => block,
      updateBlock: () => {},
    } as CodeBlockEditor
    const rendered = codeBlockSpec.implementation.render.call(
      { blockContentDOMAttributes: {}, props: undefined, renderType: 'dom' } as RenderContext,
      block,
      editor,
    )
    const host = document.createElement('div')
    host.append(rendered.dom)
    document.body.append(host)

    expect(host.querySelector('[data-content-type="codeBlock"]')?.getAttribute('data-line-numbers')).toBe('1\n2')

    rendered.destroy?.()
  })

  it('uses the light Shiki theme first in light mode', async () => {
    vi.resetModules()
    document.documentElement.classList.remove('dark')
    document.documentElement.dataset.theme = 'light'

    const { createTolariaCodeBlockOptions } = await import('./codeBlockOptions')
    const highlighter = await createTolariaCodeBlockOptions().createHighlighter?.()

    expect(highlighter?.getLoadedThemes()[0]).toBe('github-light')
  })

  it('uses the dark Shiki theme first in dark mode', async () => {
    vi.resetModules()
    document.documentElement.classList.add('dark')
    document.documentElement.dataset.theme = 'dark'

    const { createTolariaCodeBlockOptions } = await import('./codeBlockOptions')
    const highlighter = await createTolariaCodeBlockOptions().createHighlighter?.()

    expect(highlighter?.getLoadedThemes()[0]).toBe('github-dark')
  })

  it('omits the Shiki highlighter when WebKit lacks precompiled regex flags', async () => {
    installLegacyWebKitRegExp()
    vi.resetModules()

    const { createTolariaCodeBlockOptions } = await import('./codeBlockOptions')

    expect(createTolariaCodeBlockOptions()).not.toHaveProperty('createHighlighter')
  })

  it('omits the Shiki highlighter when WebKit lacks regex lookbehind syntax', async () => {
    installLookbehindMissingRegExp()
    vi.resetModules()

    const { createTolariaCodeBlockOptions } = await import('./codeBlockOptions')

    expect(createTolariaCodeBlockOptions()).not.toHaveProperty('createHighlighter')
  })
})
