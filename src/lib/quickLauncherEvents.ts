export const QUICK_LAUNCHER_OPEN_NOTE_EVENT = 'quick-launcher-open-note'

export interface QuickLauncherOpenNotePayload {
  url: string
}

export function quickLauncherOpenNoteUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const url = (payload as Partial<QuickLauncherOpenNotePayload>).url
  return typeof url === 'string' && url.startsWith('tolaria://') ? url : null
}
