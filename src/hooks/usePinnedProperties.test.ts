import { describe, it, expect } from 'vitest'
import {
  resolvePinIcon,
  serialisePinnedConfig,
  parsePinnedConfig,
} from './usePinnedProperties'
import type { PinnedPropertyConfig } from '../types'

describe('resolvePinIcon', () => {
  it('returns explicit icon when provided', () => {
    expect(resolvePinIcon('status', 'star')).toBe('star')
  })

  it('returns default icon for known keys', () => {
    expect(resolvePinIcon('status', null)).toBe('circle-dot')
    expect(resolvePinIcon('Status', null)).toBe('circle-dot')
    expect(resolvePinIcon('date', null)).toBe('calendar')
    expect(resolvePinIcon('Belongs to', null)).toBe('arrow-up-right')
    expect(resolvePinIcon('Related to', null)).toBe('arrows-left-right')
    expect(resolvePinIcon('Due date', null)).toBe('calendar')
  })

  it('returns fallback icon for unknown keys', () => {
    expect(resolvePinIcon('Priority', null)).toBe('arrow-up-right')
  })
})

describe('serialisePinnedConfig', () => {
  it('serialises configs with icons', () => {
    const configs: PinnedPropertyConfig[] = [
      { key: 'Status', icon: 'circle-dot' },
      { key: 'date', icon: 'calendar' },
    ]
    expect(serialisePinnedConfig(configs)).toEqual(['Status:circle-dot', 'date:calendar'])
  })

  it('serialises configs without icons', () => {
    const configs: PinnedPropertyConfig[] = [
      { key: 'Status', icon: null },
    ]
    expect(serialisePinnedConfig(configs)).toEqual(['Status'])
  })

  it('handles empty array', () => {
    expect(serialisePinnedConfig([])).toEqual([])
  })
})

describe('parsePinnedConfig', () => {
  it('parses key:icon format', () => {
    expect(parsePinnedConfig(['Status:circle-dot'])).toEqual([
      { key: 'Status', icon: 'circle-dot' },
    ])
  })

  it('parses key-only format', () => {
    expect(parsePinnedConfig(['Status'])).toEqual([
      { key: 'Status', icon: null },
    ])
  })

  it('handles mixed formats', () => {
    const result = parsePinnedConfig(['Status:circle-dot', 'Priority', 'date:calendar'])
    expect(result).toEqual([
      { key: 'Status', icon: 'circle-dot' },
      { key: 'Priority', icon: null },
      { key: 'date', icon: 'calendar' },
    ])
  })

  it('round-trips with serialise', () => {
    const configs: PinnedPropertyConfig[] = [
      { key: 'Status', icon: 'circle-dot' },
      { key: 'Belongs to', icon: 'arrow-up-right' },
    ]
    expect(parsePinnedConfig(serialisePinnedConfig(configs))).toEqual(configs)
  })
})
