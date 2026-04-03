import { describe, it, expect } from 'vitest'
import { _scrubPathsForTest as scrubPaths, trackEvent } from './telemetry'

describe('telemetry scrubPaths', () => {
  it('redacts macOS absolute paths', () => {
    expect(scrubPaths('Error in /Users/luca/Laputa/note.md')).toBe(
      'Error in <redacted-path>'
    )
  })

  it('redacts Linux absolute paths', () => {
    expect(scrubPaths('Error in /home/user/vault/note.md')).toBe(
      'Error in <redacted-path>'
    )
  })

  it('redacts Windows paths', () => {
    expect(scrubPaths('Error in C:\\Users\\luca\\docs\\file.md')).toBe(
      'Error in <redacted-path>'
    )
  })

  it('leaves non-path strings untouched', () => {
    expect(scrubPaths('Something went wrong')).toBe('Something went wrong')
  })

  it('redacts multiple paths in one string', () => {
    const input = 'Failed copying /a/b/c to /x/y/z'
    expect(scrubPaths(input)).toBe('Failed copying <redacted-path> to <redacted-path>')
  })
})

describe('trackEvent', () => {
  it('does not throw when PostHog is not initialized', () => {
    expect(() => trackEvent('test_event', { count: 1 })).not.toThrow()
  })

  it('accepts event name with no properties', () => {
    expect(() => trackEvent('note_created')).not.toThrow()
  })

  it('accepts event name with string and number properties', () => {
    expect(() => trackEvent('note_created', { has_type: 1, creation_path: 'cmd_n' })).not.toThrow()
  })
})
