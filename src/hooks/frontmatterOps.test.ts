import { describe, it, expect } from 'vitest'
import { frontmatterToEntryPatch } from './frontmatterOps'

describe('frontmatterToEntryPatch — _pinned_properties', () => {
  it('patches pinnedProperties on update', () => {
    const result = frontmatterToEntryPatch('update', '_pinned_properties', ['Status:circle-dot', 'Date'])
    expect(result.patch.pinnedProperties).toEqual([
      { key: 'Status', icon: 'circle-dot' },
      { key: 'Date', icon: null },
    ])
    expect(result.relationshipPatch).toBeNull()
  })

  it('clears pinnedProperties on delete', () => {
    const result = frontmatterToEntryPatch('delete', '_pinned_properties')
    expect(result.patch.pinnedProperties).toEqual([])
    expect(result.relationshipPatch).toBeNull()
  })

  it('ignores non-array _pinned_properties values', () => {
    const result = frontmatterToEntryPatch('update', '_pinned_properties', 'not-an-array')
    // Falls through to default handling (no patch for unknown keys)
    expect(result.patch.pinnedProperties).toBeUndefined()
  })
})
