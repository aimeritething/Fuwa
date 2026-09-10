/**
 * Fuwa ships no analytics. The named helpers the kept tree imports stay so the
 * call sites are unchanged; each one is a no-op.
 */

import type { FilePreviewKind } from '../utils/filePreview'

type FilePreviewAction = 'copy_deep_link' | 'copy_path' | 'open_external' | 'reveal'

export function trackFilePreviewOpened(previewKind: FilePreviewKind | null): void {
  void previewKind
}

export function trackFilePreviewAction(action: FilePreviewAction, previewKind: FilePreviewKind | null): void {
  void action
  void previewKind
}

export function trackFilePreviewFailed(previewKind: FilePreviewKind): void {
  void previewKind
}

export function trackInlineImageLightboxOpened(): void {}
