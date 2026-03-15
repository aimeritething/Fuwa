import { useEffect, useRef, useState, type RefObject } from 'react'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { isTauri } from '../mock-tauri'

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

function hasImageFiles(dt: DataTransfer): boolean {
  for (let i = 0; i < dt.items.length; i++) {
    if (dt.items[i].kind === 'file' && IMAGE_MIME_TYPES.includes(dt.items[i].type)) return true
  }
  return false
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

interface UseImageDropOptions {
  containerRef: RefObject<HTMLDivElement | null>
  /** Called with an asset URL for each image dropped. */
  onImageUrl?: (url: string) => void
  vaultPath?: string
}

/**
 * Handles image drag-and-drop via HTML5 DnD events only.
 *
 * Native Tauri drag-drop is disabled (`dragDropEnabled: false` in tauri.conf.json)
 * so that HTML5 DnD works for both internal drags (tabs, blocks) and OS file drops.
 * OS-dropped image files are read through the standard DataTransfer API and saved
 * via the `save_image` Tauri command (same as paste-upload).
 */
export function useImageDrop({ containerRef, onImageUrl, vaultPath }: UseImageDropOptions) {
  const [isDragOver, setIsDragOver] = useState(false)
  const onImageUrlRef = useRef(onImageUrl)
  useEffect(() => { onImageUrlRef.current = onImageUrl }, [onImageUrl])
  const vaultPathRef = useRef(vaultPath)
  useEffect(() => { vaultPathRef.current = vaultPath }, [vaultPath])

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
    const onDrop = (e: DragEvent) => {
      setIsDragOver(false)
      if (!e.dataTransfer || !hasImageFiles(e.dataTransfer)) return
      // Prevent browser default (open file in tab) for OS image drops
      e.preventDefault()
      const callback = onImageUrlRef.current
      const vault = vaultPathRef.current
      if (!callback) return
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i]
        if (IMAGE_MIME_TYPES.includes(file.type)) {
          void uploadImageFile(file, vault).then(callback)
        }
      }
    }

    container.addEventListener('dragover', onOver)
    container.addEventListener('dragleave', onLeave)
    container.addEventListener('drop', onDrop)
    return () => {
      container.removeEventListener('dragover', onOver)
      container.removeEventListener('dragleave', onLeave)
      container.removeEventListener('drop', onDrop)
    }
  }, [containerRef])

  return { isDragOver }
}
