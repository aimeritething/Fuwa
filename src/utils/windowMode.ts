/**
 * Detects whether the current window is a secondary "note window" (opened via
 * "Open in New Window") by inspecting URL query parameters.
 */

export interface NoteWindowParams {
  notePath: string
  vaultPath: string
  noteTitle: string
}

export function isNoteWindow(): boolean {
  return new URLSearchParams(window.location.search).get('window') === 'note'
}

export function getNoteWindowParams(): NoteWindowParams | null {
  const params = new URLSearchParams(window.location.search)
  if (params.get('window') !== 'note') return null
  const notePath = params.get('path')
  const vaultPath = params.get('vault')
  const noteTitle = params.get('title') ?? 'Untitled'
  if (!notePath || !vaultPath) return null
  return { notePath, vaultPath, noteTitle }
}
