import { invoke } from '@tauri-apps/api/core'
import DOMPurify from 'dompurify'
import { portableAttachmentPathFromCurrentVaultPath } from './vaultAttachments'

export type RemotePasteImage = {
  alt: string
  url: string
}

export type RemoteImageImportResult = {
  failedCount: number
  replacements: Map<string, string>
  totalCount: number
}

type RemoteImageDownloadRequest = {
  url: string
  vaultPath: string
}
type DownloadRemoteImage = (request: RemoteImageDownloadRequest) => Promise<string>

const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/giu
const REMOTE_PROTOCOLS = new Set(['http:', 'https:'])

function remoteUrl({ value, baseUrl }: { value: string | null; baseUrl?: string }): string | null {
  if (!value) return null
  try {
    const url = new URL(value.trim(), baseUrl)
    return REMOTE_PROTOCOLS.has(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

function firstSrcsetUrl({ value, baseUrl }: { value: string | null; baseUrl?: string }): string | null {
  const firstCandidate = value?.split(',')[0]?.trim().split(/\s+/u)[0]
  return remoteUrl({ value: firstCandidate ?? null, baseUrl })
}

function imageUrl(element: HTMLImageElement, baseUrl?: string): string | null {
  return remoteUrl({ value: element.getAttribute('data-src'), baseUrl })
    ?? remoteUrl({ value: element.getAttribute('data-original'), baseUrl })
    ?? remoteUrl({ value: element.getAttribute('src'), baseUrl })
    ?? firstSrcsetUrl({ value: element.getAttribute('srcset'), baseUrl })
}

function sanitizeMarkup(markup: string): string {
  return DOMPurify.sanitize(markup)
}

function markupRemoteImages(markup: string): RemotePasteImage[] {
  if (!markup) return []
  const sourceDocument = new DOMParser().parseFromString(markup, 'text/html')
  const document = new DOMParser().parseFromString(sanitizeMarkup(markup), 'text/html')
  const baseUrl = remoteUrl({
    value: sourceDocument.querySelector('base')?.getAttribute('href') ?? null,
  }) ?? undefined
  return Array.from(document.querySelectorAll('img')).flatMap((element) => {
    const url = imageUrl(element, baseUrl)
    return url ? [{ alt: element.getAttribute('alt') ?? '', url }] : []
  })
}

function markdownRemoteImages({ markdown }: { markdown: string }): RemotePasteImage[] {
  return Array.from(markdown.matchAll(MARKDOWN_IMAGE_RE), match => ({
    alt: match.at(1) ?? '',
    url: match.at(2) ?? '',
  }))
}

function uniqueImages(images: RemotePasteImage[]): RemotePasteImage[] {
  const seen = new Set<string>()
  return images.filter(({ url }) => {
    if (!url || seen.has(url)) return false
    seen.add(url)
    return true
  })
}

function markdownAlt({ alt }: Pick<RemotePasteImage, 'alt'>): string {
  return alt.replace(/\\/gu, '\\\\').replace(/\]/gu, '\\]')
}

function appendedRemoteImages({ text, images }: { text: string; images: RemotePasteImage[] }): string {
  const missingImages = images.filter(({ url }) => !text.includes(url))
  if (missingImages.length === 0) return text

  const markdown = missingImages
    .map(({ alt, url }) => `![${markdownAlt({ alt })}](${url})`)
    .join('\n\n')
  return text.length > 0 ? `${text}\n\n${markdown}` : markdown
}

async function invokeRemoteImageDownload({ url, vaultPath }: RemoteImageDownloadRequest): Promise<string> {
  return invoke<string>('download_remote_image_to_vault', { url, vaultPath })
}

function importedReplacement(
  download: DownloadRemoteImage,
  image: RemotePasteImage,
  vaultPath: string,
): Promise<[string, string] | null> {
  return download({ url: image.url, vaultPath }).then((path) => {
    const portablePath = portableAttachmentPathFromCurrentVaultPath({ path, vaultPath })
    return portablePath ? [image.url, portablePath] as [string, string] : null
  }).catch(() => null)
}

export function clipboardRemoteImages(data: DataTransfer): RemotePasteImage[] {
  return uniqueImages([
    ...markupRemoteImages(data.getData('text/html')),
    ...markdownRemoteImages({ markdown: data.getData('text/plain') }),
  ])
}

export function rawRemoteImagePasteText(data: DataTransfer): string {
  const text = data.getData('text/plain')
  return appendedRemoteImages({
    text,
    images: markupRemoteImages(data.getData('text/html')),
  })
}

export async function importRemoteImages({
  download = invokeRemoteImageDownload,
  images,
  vaultPath,
}: {
  download?: DownloadRemoteImage
  images: RemotePasteImage[]
  vaultPath: string
}): Promise<RemoteImageImportResult> {
  const imported = await Promise.all(
    images.map(image => importedReplacement(download, image, vaultPath)),
  )
  const replacements = new Map(imported.filter((entry): entry is [string, string] => entry !== null))
  return {
    failedCount: images.length - replacements.size,
    replacements,
    totalCount: images.length,
  }
}

export function replaceImportedRemoteImages(
  { text, replacements }: { text: string; replacements: ReadonlyMap<string, string> },
): string {
  return Array.from(replacements.entries())
    .sort(([left], [right]) => right.length - left.length)
    .reduce((updated, [remoteUrl, attachmentPath]) => (
      updated.split(remoteUrl).join(attachmentPath)
    ), text)
}
