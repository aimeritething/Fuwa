import {
  emptyImageUploadResult,
  isUnsupportedImageFormatError,
  uploadImageFile,
  type UploadImageFileResult,
} from './use-image-drop'

/**
 * BlockNote's `uploadFile`: the file behind a ⌘V or a drop the editor handled
 * itself becomes an Attachment beside the Document, and the image block points
 * at its asset URL.
 *
 * Fuwa has no toasts, so a format the kernel cannot import is logged and the
 * block is left empty rather than announced.
 */
export async function uploadEditorImage(
  file: File,
  vaultPath: string | undefined,
): Promise<UploadImageFileResult> {
  try {
    return await uploadImageFile(file, vaultPath)
  } catch (error) {
    if (!isUnsupportedImageFormatError(error)) throw error

    console.warn('[editor] Unsupported image format:', error.message)
    return emptyImageUploadResult(file)
  }
}
