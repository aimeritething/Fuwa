import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  trackQuickCaptureSaved,
  trackQuickLauncherOpened,
  trackQuickLauncherResultOpened,
  trackQuickLauncherSearchCompleted,
} from './productAnalytics'

const mocks = vi.hoisted(() => ({ trackEvent: vi.fn() }))
vi.mock('./telemetry', () => ({ trackEvent: mocks.trackEvent }))

describe('quick launcher analytics privacy', () => {
  beforeEach(() => vi.clearAllMocks())

  it('records adoption with buckets and no note or query content', () => {
    trackQuickLauncherOpened()
    trackQuickLauncherSearchCompleted({ failedVaultCount: 1, queryLength: 19, resultCount: 7, scope: 'all' })
    trackQuickLauncherResultOpened('path')
    trackQuickCaptureSaved({ collided: true, openedAfterSave: false })

    expect(mocks.trackEvent.mock.calls).toEqual([
      ['quick_launcher_opened', {}],
      ['quick_launcher_search_completed', { failed_vault_count: 1, query_length_bucket: 'medium', result_count_bucket: 'some', scope: 'all' }],
      ['quick_launcher_result_opened', { match_category: 'path' }],
      ['quick_capture_saved', { collision_avoided: 1, opened_after_save: 0 }],
    ])
  })
})
