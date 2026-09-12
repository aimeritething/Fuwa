/**
 * What makes a file an Image file (CONTEXT.md): Fuwa shows it and never edits
 * it. This one list decides what the Explorer lists, what a drop may turn into
 * an Attachment, what the Rust scanner calls an image, and what opens as an
 * Image Tab. Tolaria's pdf, audio and video branches are trimmed away:
 * Fuwa previews nothing else.
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
