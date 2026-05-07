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

// Matches markdown image syntax: ![alt](url) or ![alt](url "title").
const MD_IMAGE_PATTERN = /!\[([^\]]*)\]\(([^)\s"]+)(\s+"[^"]*")?\)/g

function rewriteMarkdownImages(
  markdown: Markdown,
  transformUrl: (url: MarkdownImageUrl) => MarkdownImageUrl | null,
): Markdown {
  return markdown.replace(MD_IMAGE_PATTERN, (match, alt, url, title = '') => {
    const nextUrl = transformUrl(url)
    return nextUrl ? `![${alt}](${nextUrl}${title})` : match
  })
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
