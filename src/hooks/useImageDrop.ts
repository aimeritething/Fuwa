import { useEffect, useRef, useState, type RefObject } from 'react'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { isTauri } from '../mock-tauri'

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff']

function hasImageFiles(dt: DataTransfer): boolean {
  for (let i = 0; i < dt.items.length; i++) {
    if (dt.items[i].kind === 'file' && IMAGE_MIME_TYPES.includes(dt.items[i].type)) return true
  }
  return false
}

function isImagePath(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_EXTENSIONS.includes(ext)
}

/** Upload an image file — saves to vault/attachments in Tauri, returns data URL in browser */
export async function uploadImageFile(file: File, vaultPath?: string): Promise<string> {
  if (isTauri() && vaultPath) {
    const buf = await file.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const base64 = btoa(binary)
    const savedPath = await invoke<string>('save_image', {
      vaultPath,
      filename: file.name,
      data: base64,
    })
    return convertFileSrc(savedPath)
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** Copy a dropped file (by OS path) into vault/attachments and return its asset URL. */
async function copyImageToVault(sourcePath: string, vaultPath: string): Promise<string> {
  const savedPath = await invoke<string>('copy_image_to_vault', { vaultPath, sourcePath })
  return convertFileSrc(savedPath)
}

interface UseImageDropOptions {
  containerRef: RefObject<HTMLDivElement | null>
  /** Called with an asset URL for each image dropped via Tauri native drag-drop. */
  onImageUrl?: (url: string) => void
  vaultPath?: string
}

/** Track whether an internal HTML5 drag (tab, block) is in progress.
 *  Internal drags fire `dragstart` on a DOM element; OS file drags do not. */
function useInternalDragFlag() {
  const ref = useRef(false)
  useEffect(() => {
    const start = () => { ref.current = true }
    const end = () => { ref.current = false }
    document.addEventListener('dragstart', start)
    document.addEventListener('dragend', end)
    return () => { document.removeEventListener('dragstart', start); document.removeEventListener('dragend', end) }
  }, [])
  return ref
}

/** Process a Tauri native file drop payload — copy images to vault. */
function handleTauriDrop(
  paths: string[],
  vaultPath: string | undefined,
  callback: ((url: string) => void) | undefined,
) {
  const imagePaths = paths.filter(isImagePath)
  if (imagePaths.length > 0 && vaultPath && callback) {
    for (const p of imagePaths) void copyImageToVault(p, vaultPath).then(callback)
  }
}

export function useImageDrop({ containerRef, onImageUrl, vaultPath }: UseImageDropOptions) {
  const [isDragOver, setIsDragOver] = useState(false)
  const onImageUrlRef = useRef(onImageUrl)
  useEffect(() => { onImageUrlRef.current = onImageUrl }, [onImageUrl])
  const vaultPathRef = useRef(vaultPath)
  useEffect(() => { vaultPathRef.current = vaultPath }, [vaultPath])
  const internalDragRef = useInternalDragFlag()

  // HTML5 DnD visual feedback (works in browser mode; BlockNote handles the actual upload)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onOver = (e: DragEvent) => {
      if (!e.dataTransfer || !hasImageFiles(e.dataTransfer)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setIsDragOver(true)
    }
    const onLeave = (e: DragEvent) => {
      if (!container.contains(e.relatedTarget as Node)) setIsDragOver(false)
    }
    const onDrop = () => { setIsDragOver(false) }

    container.addEventListener('dragover', onOver)
    container.addEventListener('dragleave', onLeave)
    container.addEventListener('drop', onDrop)
    return () => {
      container.removeEventListener('dragover', onOver)
      container.removeEventListener('dragleave', onLeave)
      container.removeEventListener('drop', onDrop)
    }
  }, [containerRef])

  // Tauri native file drop — intercepts OS file drops that bypass HTML5 DnD.
  // Skipped entirely when an internal drag is in progress (tabs, blocks).
  useEffect(() => {
    if (!isTauri()) return
    let unlisten: (() => void) | null = null
    let mounted = true
    void (async () => {
      try {
        const { getCurrentWebview } = await import('@tauri-apps/api/webview')
        if (!mounted) return
        unlisten = await getCurrentWebview().onDragDropEvent(({ payload }) => {
          if (internalDragRef.current) return
          if (payload.type === 'drop') {
            setIsDragOver(false)
            handleTauriDrop(payload.paths, vaultPathRef.current, onImageUrlRef.current)
          } else if (payload.type !== 'over') {
            setIsDragOver(false)
          }
        })
      } catch { /* Tauri webview API not available */ }
    })()
    return () => { mounted = false; unlisten?.() }
  }, [internalDragRef])

  return { isDragOver }
}
