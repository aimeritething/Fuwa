import type { Settings, NoteWidthMode } from '../types'
import { trackEvent } from '../lib/telemetry'
import {
  trackDateDisplayFormatChanged,
  trackDefaultNoteWidthChanged,
  trackSidebarTypePluralizationChanged,
} from '../lib/productAnalytics'
import {
  DEFAULT_DATE_DISPLAY_FORMAT,
  normalizeDateDisplayFormat,
  type DateDisplayFormat,
} from '../utils/dateDisplay'
import { DEFAULT_NOTE_WIDTH_MODE, normalizeNoteWidthMode } from '../utils/noteWidth'

export interface SettingsPreferenceDraft {
  analytics: boolean
  dateDisplayFormat: DateDisplayFormat
  defaultNoteWidth: NoteWidthMode
  sidebarTypePluralizationEnabled: boolean
}

export function trackTelemetryConsentChange(previousAnalytics: boolean, nextAnalytics: boolean): void {
  if (!previousAnalytics && nextAnalytics) trackEvent('telemetry_opted_in')
  if (previousAnalytics && !nextAnalytics) trackEvent('telemetry_opted_out')
}

export function trackSettingsPreferenceChanges(settings: Settings, draft: SettingsPreferenceDraft): void {
  const previousDateDisplayFormat = normalizeDateDisplayFormat(settings.date_display_format) ?? DEFAULT_DATE_DISPLAY_FORMAT
  if (previousDateDisplayFormat !== draft.dateDisplayFormat) {
    trackDateDisplayFormatChanged(draft.dateDisplayFormat)
  }

  const previousNoteWidth = normalizeNoteWidthMode(settings.note_width_mode) ?? DEFAULT_NOTE_WIDTH_MODE
  if (previousNoteWidth !== draft.defaultNoteWidth) {
    trackDefaultNoteWidthChanged(draft.defaultNoteWidth)
  }

  const previousPluralization = settings.sidebar_type_pluralization_enabled ?? true
  if (previousPluralization !== draft.sidebarTypePluralizationEnabled) {
    trackSidebarTypePluralizationChanged(draft.sidebarTypePluralizationEnabled)
  }
}
