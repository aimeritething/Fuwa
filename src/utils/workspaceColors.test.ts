import { describe, expect, it } from 'vitest'
import { DEFAULT_WORKSPACE_COLOR, WORKSPACE_COLORS, workspaceColorSupportsNativeIcon } from './workspaceColors'

describe('workspace color contract', () => {
  it('preserves the renderer workspace palette order', () => {
    expect(WORKSPACE_COLORS).toEqual([
      'red',
      'orange',
      'yellow',
      'green',
      'blue',
      'purple',
      'pink',
      'gray',
    ])
    expect(DEFAULT_WORKSPACE_COLOR).toBe('blue')
  })

  it('makes renderer-only native icon support explicit', () => {
    expect(workspaceColorSupportsNativeIcon('red')).toBe(true)
    expect(workspaceColorSupportsNativeIcon('pink')).toBe(false)
    expect(workspaceColorSupportsNativeIcon('gray')).toBe(false)
  })
})
