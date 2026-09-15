// The DOM shape of a fenced code block as BlockNote hands it to a block spec's
// `parse`: a <pre> whose one <code> child is tagged with the fence's language.
// The html block and the mermaid block claim their fences through this.

function codeElementLanguage(code: Element): string | null {
  const language = code.getAttribute('data-language')
    ?? Array.from(code.classList)
      .find(className => className.startsWith('language-'))
      ?.replace(/^language-/u, '')
  if (!language) return null

  return language.trim().split(/\s+/u)[0]?.toLowerCase() ?? null
}

/** The fence body, with its trailing newline, when `element` is a `<pre><code>` of `language`. */
export function readFencedPreElement(element: HTMLElement, language: string): string | undefined {
  if (element.tagName !== 'PRE') return undefined
  if (element.childElementCount !== 1 || element.firstElementChild?.tagName !== 'CODE') return undefined

  const code = element.firstElementChild
  if (codeElementLanguage(code) !== language) return undefined

  return code.textContent?.endsWith('\n')
    ? code.textContent
    : `${code.textContent ?? ''}\n`
}
