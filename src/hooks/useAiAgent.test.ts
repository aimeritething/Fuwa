import { describe, it, expect, vi } from 'vitest'
import { detectFileOperation, parseBashFileCreation } from './useAiAgent'
import type { AgentFileCallbacks } from './useAiAgent'

const VAULT = '/Users/luca/Laputa'

function makeCallbacks() {
  return {
    onFileCreated: vi.fn(),
    onFileModified: vi.fn(),
  } satisfies AgentFileCallbacks
}

describe('detectFileOperation', () => {
  it('calls onFileCreated for Write tool with .md in vault', () => {
    const cb = makeCallbacks()
    detectFileOperation('Write', JSON.stringify({ file_path: `${VAULT}/note/test.md` }), VAULT, cb)
    expect(cb.onFileCreated).toHaveBeenCalledWith('note/test.md')
    expect(cb.onFileModified).not.toHaveBeenCalled()
  })

  it('calls onFileModified for Edit tool with .md in vault', () => {
    const cb = makeCallbacks()
    detectFileOperation('Edit', JSON.stringify({ file_path: `${VAULT}/note/test.md` }), VAULT, cb)
    expect(cb.onFileModified).toHaveBeenCalledWith('note/test.md')
    expect(cb.onFileCreated).not.toHaveBeenCalled()
  })

  it('ignores non-md files', () => {
    const cb = makeCallbacks()
    detectFileOperation('Write', JSON.stringify({ file_path: `${VAULT}/image.png` }), VAULT, cb)
    expect(cb.onFileCreated).not.toHaveBeenCalled()
  })

  it('ignores files outside vault', () => {
    const cb = makeCallbacks()
    detectFileOperation('Write', JSON.stringify({ file_path: '/tmp/other.md' }), VAULT, cb)
    expect(cb.onFileCreated).not.toHaveBeenCalled()
  })

  it('ignores unknown tool names', () => {
    const cb = makeCallbacks()
    detectFileOperation('Read', JSON.stringify({ file_path: `${VAULT}/note/test.md` }), VAULT, cb)
    expect(cb.onFileCreated).not.toHaveBeenCalled()
    expect(cb.onFileModified).not.toHaveBeenCalled()
  })

  it('handles undefined input gracefully', () => {
    const cb = makeCallbacks()
    detectFileOperation('Write', undefined, VAULT, cb)
    expect(cb.onFileCreated).not.toHaveBeenCalled()
  })

  it('handles malformed JSON input gracefully', () => {
    const cb = makeCallbacks()
    detectFileOperation('Write', 'not-json', VAULT, cb)
    expect(cb.onFileCreated).not.toHaveBeenCalled()
  })

  it('handles undefined callbacks gracefully', () => {
    expect(() => detectFileOperation('Write', JSON.stringify({ file_path: `${VAULT}/note/test.md` }), VAULT, undefined)).not.toThrow()
  })

  it('detects Bash redirect creating .md file in vault', () => {
    const cb = makeCallbacks()
    detectFileOperation('Bash', JSON.stringify({ command: `echo "# Note" > ${VAULT}/note/new.md` }), VAULT, cb)
    expect(cb.onFileCreated).toHaveBeenCalledWith('note/new.md')
  })

  it('detects Bash append redirect creating .md file', () => {
    const cb = makeCallbacks()
    detectFileOperation('Bash', JSON.stringify({ command: `cat content.txt >> ${VAULT}/daily/2026-03-07.md` }), VAULT, cb)
    expect(cb.onFileCreated).toHaveBeenCalledWith('daily/2026-03-07.md')
  })

  it('detects Bash tee command creating .md file', () => {
    const cb = makeCallbacks()
    detectFileOperation('Bash', JSON.stringify({ command: `echo "content" | tee ${VAULT}/note/tee-note.md` }), VAULT, cb)
    expect(cb.onFileCreated).toHaveBeenCalledWith('note/tee-note.md')
  })

  it('ignores Bash commands without file creation', () => {
    const cb = makeCallbacks()
    detectFileOperation('Bash', JSON.stringify({ command: 'ls -la' }), VAULT, cb)
    expect(cb.onFileCreated).not.toHaveBeenCalled()
  })

  it('ignores Bash creating non-md files', () => {
    const cb = makeCallbacks()
    detectFileOperation('Bash', JSON.stringify({ command: `echo "data" > ${VAULT}/config.json` }), VAULT, cb)
    expect(cb.onFileCreated).not.toHaveBeenCalled()
  })

  it('ignores Bash creating .md files outside vault', () => {
    const cb = makeCallbacks()
    detectFileOperation('Bash', JSON.stringify({ command: 'echo "text" > /tmp/other.md' }), VAULT, cb)
    expect(cb.onFileCreated).not.toHaveBeenCalled()
  })

  it('uses path field when file_path is missing', () => {
    const cb = makeCallbacks()
    detectFileOperation('Write', JSON.stringify({ path: `${VAULT}/note/alt.md` }), VAULT, cb)
    expect(cb.onFileCreated).toHaveBeenCalledWith('note/alt.md')
  })
})

describe('parseBashFileCreation', () => {
  it('returns null for undefined input', () => {
    expect(parseBashFileCreation(undefined, VAULT)).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(parseBashFileCreation('not json', VAULT)).toBeNull()
  })

  it('returns null when no command field', () => {
    expect(parseBashFileCreation(JSON.stringify({ other: 'value' }), VAULT)).toBeNull()
  })

  it('returns null when command is not a string', () => {
    expect(parseBashFileCreation(JSON.stringify({ command: 42 }), VAULT)).toBeNull()
  })

  it('parses simple redirect', () => {
    const input = JSON.stringify({ command: `echo "# Title" > ${VAULT}/note.md` })
    expect(parseBashFileCreation(input, VAULT)).toBe('note.md')
  })

  it('parses append redirect', () => {
    const input = JSON.stringify({ command: `echo "line" >> ${VAULT}/sub/note.md` })
    expect(parseBashFileCreation(input, VAULT)).toBe('sub/note.md')
  })

  it('parses tee command', () => {
    const input = JSON.stringify({ command: `echo "data" | tee ${VAULT}/new.md` })
    expect(parseBashFileCreation(input, VAULT)).toBe('new.md')
  })

  it('parses tee -a (append) command', () => {
    const input = JSON.stringify({ command: `echo "extra" | tee -a ${VAULT}/new.md` })
    expect(parseBashFileCreation(input, VAULT)).toBe('new.md')
  })

  it('returns null for non-md redirect', () => {
    const input = JSON.stringify({ command: `echo "x" > ${VAULT}/file.txt` })
    expect(parseBashFileCreation(input, VAULT)).toBeNull()
  })
})
