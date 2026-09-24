import { useCallback, useState } from 'react'
import { imageAssetUrl } from '@/platform/image-asset'
import type { ImageNaturalSize } from '@/tabs/image-file'
import { FilePreviewFallback, FilePreviewImage } from './file-preview'

/**
 * An Image Tab's body. The picture sits in the middle of the
 * editor pane, padded to the prose column, scaled down to fit and never scaled up:
 * there is no zoom and nothing to scroll. It is shown, never edited, so the
 * view has no editor under it and mounts no drop intake (ADR-0006).
 *
 * An SVG goes through `<img>`, which renders its markup and runs none of its
 * scripts. A picture the protocol will not serve leaves the fallback in its
 * place, whose one button hands the file to the default app.
 */

export interface ImageViewProps {
  path: string
  filename: string
  /** Changes when the file changes on disk, so the overwritten picture is fetched rather than recalled. */
  version: string
  /** The natural size once the browser has it, or null while there is none to show. */
  onNaturalSize: (size: ImageNaturalSize | null) => void
  onOpenExternal: () => void
}

export function ImageView({ path, filename, version, onNaturalSize, onOpenExternal }: ImageViewProps) {
  const src = imageAssetUrl(path, version)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  const handleLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget
    onNaturalSize({ width: naturalWidth, height: naturalHeight })
  }, [onNaturalSize])

  const handleError = useCallback(() => {
    setFailedSrc(src)
    onNaturalSize(null)
  }, [onNaturalSize, src])

  // The prose column's padding on both axes, so a picture sits where a Document's first line would.
  return (
    <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden px-(--editor-padding-horizontal) py-(--editor-padding-vertical)" data-testid="image-view">
      {src !== null && src !== failedSrc ? (
        <FilePreviewImage src={src} alt={filename} onLoad={handleLoad} onError={handleError} />
      ) : (
        <FilePreviewFallback
          title={`Couldn't show ${filename}`}
          description="The file may have moved, or it may not be a picture this system can draw."
          onOpenExternal={onOpenExternal}
        />
      )}
    </div>
  )
}
