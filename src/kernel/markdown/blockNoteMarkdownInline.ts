const WORD_CHARACTER_RE = /[\p{L}\p{N}]/u
const MARKDOWN_ESCAPABLE_PUNCTUATION_RE = /[!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~]/u

function shouldEscapeBackslash(nextCharacter: string): boolean {
  return nextCharacter !== '{' && MARKDOWN_ESCAPABLE_PUNCTUATION_RE.test(nextCharacter)
}

export function escapeInlineMarkdownText(text: string): string {
  const characters = [...text]
  return characters.map((character, index) => {
    if (character === '\\') {
      return shouldEscapeBackslash(characters.at(index + 1) ?? '') ? '\\\\' : character
    }
    if (character === '`' || character === '*') return `\\${character}`
    if (character !== '_') return character
    const surroundedByWordCharacters = WORD_CHARACTER_RE.test(characters.at(index - 1) ?? '')
      && WORD_CHARACTER_RE.test(characters.at(index + 1) ?? '')
    return surroundedByWordCharacters ? character : `\\${character}`
  }).join('')
}

export function wrapInlineMarkdown(text: string, marker: string): string {
  if (!text) return text
  const leadingWhitespace = text.match(/^\s*/u)?.[0] ?? ''
  const trailingWhitespace = text.slice(leadingWhitespace.length).match(/\s*$/u)?.[0] ?? ''
  const contentEnd = text.length - trailingWhitespace.length
  const content = text.slice(leadingWhitespace.length, contentEnd)
  if (!content) return text
  return `${leadingWhitespace}${marker}${content}${marker}${trailingWhitespace}`
}
