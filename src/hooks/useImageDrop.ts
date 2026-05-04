import { useEffect, useRef, useState, type RefObject } from 'react'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { isTauri } from '../mock-tauri'
import { useTauriDragDropEvent, type TauriDragDropEvent } from './useTauriDragDropEvent'

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff']
const IMAGE_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/bmp': 'bmp',
  'image/gif': 'gif',
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/tiff': 'tiff',
  'image/webp': 'webp',
}

type ImageUrlHandler = (url: string) => void
type ClipboardFileItem = {
  getAsFile: () => File | null
  kind: string
  type: string
}
type ClipboardFileItems = {
  length: number
  [index: number]: ClipboardFileItem | undefined
}
type ClipboardFiles = {
  length: number
  [index: number]: File | undefined
}
type ClipboardImageData = {
  files?: ClipboardFiles
  items?: ClipboardFileItems
} | null | undefined

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

function fileExtension(filename: string): string | null {
  const extension = filename.split('.').pop()?.toLowerCase()
  return extension && extension !== filename.toLowerCase() && IMAGE_EXTENSIONS.includes(extension)
    ? extension
    : null
}

function imageExtensionForFile(file: File): string | null {
  const filenameExtension = fileExtension(file.name)
  if (filenameExtension) return filenameExtension

  return IMAGE_EXTENSION_BY_MIME_TYPE[file.type.toLowerCase()] ?? null
}

function imageAttachmentFilename(file: File): string {
  const filename = file.name.trim()
  const extension = imageExtensionForFile(file)
  if (!filename) return extension ? `clipboard-image.${extension}` : 'clipboard-image'
  if (fileExtension(filename)) return filename
  return extension ? `${filename}.${extension}` : filename
}

function uniqueImageFiles(files: File[]): File[] {
  return files.filter((file, index) => (
    file.type.startsWith('image/') && files.indexOf(file) === index
  ))
}

function imageFileFromClipboardItem(item: ClipboardFileItem): File | null {
  if (item.kind !== 'file' || !item.type.startsWith('image/')) return null

  return item.getAsFile()
}

function clipboardItemImageFiles(items?: ClipboardFileItems): File[] {
  return Array
    .from({ length: items?.length ?? 0 }, (_, index) => items?.[index])
    .flatMap(item => item ? [imageFileFromClipboardItem(item)].filter((file): file is File => file !== null) : [])
}

function clipboardFileListImageFiles(files?: ClipboardFiles): File[] {
  return uniqueImageFiles(Array.from({ length: files?.length ?? 0 }, (_, index) => files?.[index]).filter((file): file is File => Boolean(file)))
}

export function clipboardImageFiles(clipboardData: ClipboardImageData): File[] {
  const itemFiles = uniqueImageFiles(clipboardItemImageFiles(clipboardData?.items))
  return itemFiles.length > 0
    ? itemFiles
    : clipboardFileListImageFiles(clipboardData?.files)
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
      filename: imageAttachmentFilename(file),
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

function insertDroppedImages(
  imagePaths: string[],
  vaultPath: string | undefined,
  onImageUrl: ImageUrlHandler | undefined,
): void {
  if (imagePaths.length === 0) return
  if (!vaultPath || !onImageUrl) return

  for (const sourcePath of imagePaths) {
    void copyImageToVault(sourcePath, vaultPath).then(onImageUrl)
  }
}

interface UseImageDropOptions {
  containerRef: RefObject<HTMLDivElement | null>
  /** Called with an asset URL for each image dropped via Tauri native drag-drop. */
  onImageUrl?: (url: string) => void
  vaultPath?: string
}

function useLatestImageDropRefs(onImageUrl: ImageUrlHandler | undefined, vaultPath: string | undefined) {
  const onImageUrlRef = useRef(onImageUrl)
  const vaultPathRef = useRef(vaultPath)

  useEffect(() => { onImageUrlRef.current = onImageUrl }, [onImageUrl])
  useEffect(() => { vaultPathRef.current = vaultPath }, [vaultPath])

  return { onImageUrlRef, vaultPathRef }
}

function useHtmlImageDropFeedback(
  containerRef: RefObject<HTMLDivElement | null>,
  setIsDragOver: (isDragOver: boolean) => void,
) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleDragOver = (e: DragEvent) => {
      if (!e.dataTransfer || !hasImageFiles(e.dataTransfer)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setIsDragOver(true)
    }

    const handleDragLeave = (e: DragEvent) => {
      if (!container.contains(e.relatedTarget as Node)) setIsDragOver(false)
    }

    const handleDrop = () => setIsDragOver(false)

    container.addEventListener('dragover', handleDragOver)
    container.addEventListener('dragleave', handleDragLeave)
    container.addEventListener('drop', handleDrop)

    return () => {
      container.removeEventListener('dragover', handleDragOver)
      container.removeEventListener('dragleave', handleDragLeave)
      container.removeEventListener('drop', handleDrop)
    }
  }, [containerRef, setIsDragOver])
}

function handleNativeImageDrop(
  event: TauriDragDropEvent,
  vaultPath: string | undefined,
  onImageUrl: ImageUrlHandler | undefined,
): void {
  if (event.payload.type !== 'drop') return
  insertDroppedImages(event.payload.paths.filter(isImagePath), vaultPath, onImageUrl)
}

export function useImageDrop({ containerRef, onImageUrl, vaultPath }: UseImageDropOptions) {
  const [isDragOver, setIsDragOver] = useState(false)
  const { onImageUrlRef, vaultPathRef } = useLatestImageDropRefs(onImageUrl, vaultPath)

  useHtmlImageDropFeedback(containerRef, setIsDragOver)
  useTauriDragDropEvent((event) => {
    setIsDragOver(false)
    handleNativeImageDrop(event, vaultPathRef.current, onImageUrlRef.current)
  })

  return { isDragOver }
}
