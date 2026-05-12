import { codeBlockOptions } from '@blocknote/code-block'
import { createCodeBlockSpec, type CodeBlockOptions } from '@blocknote/core'
import { supportsModernRegexFeatures } from '../utils/regexCapabilities'
import { lineNumbersForText } from '../utils/codeBlockEnhancements'

const LIGHT_CODE_THEME = 'github-light'
const DARK_CODE_THEME = 'github-dark'

type TolariaCodeHighlighter = Awaited<ReturnType<NonNullable<typeof codeBlockOptions.createHighlighter>>>

function currentCodeBlockTheme() {
  if (typeof document === 'undefined') return LIGHT_CODE_THEME

  const root = document.documentElement
  return root.classList.contains('dark') || root.dataset.theme === 'dark'
    ? DARK_CODE_THEME
    : LIGHT_CODE_THEME
}

function prioritizeTheme(themes: string[], theme: string) {
  return [theme, ...themes.filter((candidate) => candidate !== theme)]
}

async function createTolariaCodeHighlighter(): Promise<TolariaCodeHighlighter> {
  const highlighter = await codeBlockOptions.createHighlighter()
  return {
    ...highlighter,
    getLoadedThemes: () => prioritizeTheme(highlighter.getLoadedThemes(), currentCodeBlockTheme()),
  }
}

export function createTolariaCodeBlockOptions(): Partial<CodeBlockOptions> {
  const options: Partial<CodeBlockOptions> = {
    ...codeBlockOptions,
    createHighlighter: createTolariaCodeHighlighter,
    defaultLanguage: 'text',
  }

  if (supportsModernRegexFeatures()) return options

  delete options.createHighlighter
  return options
}

interface InlineTextItem {
  text?: unknown
}

interface CodeBlockRenderContext {
  blockContentDOMAttributes?: Record<string, string>
  props?: unknown
  renderType?: unknown
}

function textFromInlineContent(content: unknown): string {
  if (!Array.isArray(content)) return ''

  return content
    .map((item: InlineTextItem) => typeof item.text === 'string' ? item.text : '')
    .join('')
}

export function createTolariaCodeBlockSpec() {
  const spec = createCodeBlockSpec(createTolariaCodeBlockOptions())
  if (!spec.implementation?.render) return spec

  const baseRender = spec.implementation.render
  const render: typeof baseRender = function (this: ThisParameterType<typeof baseRender>, block, editor) {
    const context = this as CodeBlockRenderContext
    const blockContentDOMAttributes = {
      ...context.blockContentDOMAttributes,
      'data-line-numbers': lineNumbersForText(textFromInlineContent(block.content)),
    }

    return baseRender.call(
      {
        ...context,
        blockContentDOMAttributes,
      } as ThisParameterType<typeof baseRender>,
      block,
      editor,
    )
  }

  return {
    ...spec,
    implementation: {
      ...spec.implementation,
      render,
    },
  }
}
