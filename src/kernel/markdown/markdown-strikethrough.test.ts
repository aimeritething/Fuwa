import { describe, expect, it } from 'vitest'
import { preProcessSingleTildeStrikethrough } from './markdown-strikethrough'

describe('preProcessSingleTildeStrikethrough', () => {
  it('escapes single tildes while preserving double-tilde strikethrough', () => {
    expect(preProcessSingleTildeStrikethrough({
      markdown: 'Approximately ~$115, but ~~deleted~~ stays marked.',
    })).toBe('Approximately \\~$115, but ~~deleted~~ stays marked.')
  })

  it('leaves code spans and fenced code unchanged', () => {
    const markdown = [
      'Use `~/.config` literally.',
      '',
      '```',
      '~inside fence',
      '```',
    ].join('\n')

    expect(preProcessSingleTildeStrikethrough({ markdown })).toBe(markdown)
  })

  it('leaves durable placeholders unchanged', () => {
    const markdown = [
      '@@FUWA_FILE_ATTACHMENT:%7B%22name%22%3A%22file~one.md%22%7D@@',
      '\u2039WIKILINK:note~one\u203A',
    ].join('\n')

    expect(preProcessSingleTildeStrikethrough({ markdown })).toBe(markdown)
  })
})
