import type { VaultEntry } from '../types'

/**
 * What makes a file an Image file (CONTEXT.md): Fuwa shows it and never edits
 * it. This one list decides what the Explorer lists, what a drop may turn into
 * an Attachment, what the Rust scanner calls an image, and what opens as an
 * Image Tab. Tolaria's pdf, audio and video branches are trimmed away
 * (AIM-388): Fuwa previews nothing else.
 */
export const IMAGE_FILE_EXTENSIONS: readonly string[] = [
  'apng',
  'avif',
  'bmp',
  'gif',
  'ico',
  'jpeg',
  'jpg',
  'png',
  'svg',
  'tif',
  'tiff',
  'webp',
]

function extensionFromFilename(filename: string): string | null {
  const lastSegment = filename.split(/[\\/]/u).pop() ?? filename
  const dotIndex = lastSegment.lastIndexOf('.')
  if (dotIndex <= 0 || dotIndex === lastSegment.length - 1) return null
  return lastSegment.slice(dotIndex + 1).toLowerCase()
}

export function previewExtension(entry: Pick<VaultEntry, 'filename' | 'path'>): string | null {
  return extensionFromFilename(entry.filename) ?? extensionFromFilename(entry.path)
}

/** Kept for the carried editor-content state, which branches on it; Fuwa opens no `.html` Tab. */
export function isHtmlFileEntry(entry: Pick<VaultEntry, 'filename' | 'path'>): boolean {
  const extension = previewExtension(entry)
  return extension === 'html' || extension === 'htm'
}
