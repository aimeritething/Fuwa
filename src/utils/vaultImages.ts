import { isTauri } from '../mock-tauri'
import {
  isCurrentVaultAssetUrl,
  isPortableAttachmentPath,
  isTauriAssetUrl,
  portableAttachmentPathFromAnyAssetUrl,
  portableAttachmentPathFromCurrentVaultAssetUrl,
  vaultAttachmentAssetUrl,
} from './vaultAttachments'

type Markdown = string
type VaultPath = string
type MarkdownImageUrl = string

interface MarkdownImageToken {
  alt: string
  end: number
  start: number
  title: string
  url: MarkdownImageUrl
}

function rewriteMarkdownImages(
  markdown: Markdown,
  transformUrl: (url: MarkdownImageUrl) => MarkdownImageUrl | null,
): Markdown {
  let rewritten = ''
  let cursor = 0

  while (cursor < markdown.length) {
    const image = nextMarkdownImage(markdown, cursor)
    if (!image) break

    rewritten += markdown.slice(cursor, image.start)
    const nextUrl = transformUrl(image.url)
    rewritten += nextUrl
      ? `![${image.alt}](${nextUrl}${image.title})`
      : markdown.slice(image.start, image.end)
    cursor = image.end
  }

  return rewritten + markdown.slice(cursor)
}

function nextMarkdownImage(markdown: Markdown, startIndex: number): MarkdownImageToken | null {
  const start = markdown.indexOf('![', startIndex)
  if (start === -1) return null

  const altEnd = markdown.indexOf('](', start + 2)
  if (altEnd === -1) return nextMarkdownImage(markdown, start + 2)

  const destinationEnd = markdown.indexOf(')', altEnd + 2)
  if (destinationEnd === -1) return null

  const destination = parseMarkdownImageDestination(markdown.slice(altEnd + 2, destinationEnd))
  if (!destination) return nextMarkdownImage(markdown, start + 2)

  return {
    alt: markdown.slice(start + 2, altEnd),
    end: destinationEnd + 1,
    start,
    title: destination.title,
    url: destination.url,
  }
}

function parseMarkdownImageDestination(destination: string): { title: string; url: MarkdownImageUrl } | null {
  const titleStart = destination.indexOf(' "')
  const url = titleStart === -1 ? destination : destination.slice(0, titleStart)
  const title = titleStart === -1 ? '' : destination.slice(titleStart)
  if (!isMarkdownImageUrl(url)) return null
  if (title && !title.endsWith('"')) return null
  return { title, url }
}

function isMarkdownImageUrl(url: string): boolean {
  return url.length > 0 && Array.from(url).every((char) => (
    char !== ' '
    && char !== '\t'
    && char !== '\n'
    && char !== '\r'
    && char !== '"'
  ))
}

export function resolveImageUrls(markdown: Markdown, vaultPath: VaultPath): Markdown {
  if (!isTauri() || !vaultPath) return markdown

  return rewriteMarkdownImages(markdown, (url) => {
    if (isPortableAttachmentPath({ path: url })) {
      return vaultAttachmentAssetUrl({ vaultPath, attachmentPath: url })
    }

    if (!isTauriAssetUrl({ url }) || isCurrentVaultAssetUrl({ url, vaultPath })) {
      return null
    }

    const attachmentPath = portableAttachmentPathFromAnyAssetUrl({ url })
    return attachmentPath ? vaultAttachmentAssetUrl({ vaultPath, attachmentPath }) : null
  })
}

export function portableImageUrls(markdown: Markdown, vaultPath: VaultPath): Markdown {
  if (!vaultPath) return markdown

  return rewriteMarkdownImages(markdown, (url) => {
    if (!isTauriAssetUrl({ url })) return null

    return portableAttachmentPathFromCurrentVaultAssetUrl({ url, vaultPath })
  })
}
