import { splitFrontmatter } from './wikilinks'

function replaceWikilinkAliases(text: string): string {
  return text.replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g, '$1')
}

function replacePlainWikilinks(text: string): string {
  return text.replace(/\[\[([^\]]+)\]\]/g, '$1')
}

function replaceMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
}

function removeInlineMarkdownMarkers(text: string): string {
  return text.replace(/[*_`~]/g, '')
}

function stripMarkdownFormatting(text: string): string {
  return removeInlineMarkdownMarkers(
    replaceMarkdownLinks(
      replacePlainWikilinks(
        replaceWikilinkAliases(text),
      ),
    ),
  )
}

export function filenameStemToTitle(filename: string): string {
  const stem = filename.replace(/\.[^.]+$/, '')
  return stem
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function extractH1TitleFromContent(content: string): string | null {
  const [, body] = splitFrontmatter(content)

  for (const line of body.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (!trimmed.startsWith('# ')) return null
    const title = stripMarkdownFormatting(trimmed.slice(2)).trim()
    return title || null
  }

  return null
}

export function deriveDisplayTitleState(
  content: string,
  filename: string,
  frontmatterTitle?: string | null,
): { title: string, hasH1: boolean } {
  const h1Title = extractH1TitleFromContent(content)
  if (h1Title) {
    return { title: h1Title, hasH1: true }
  }

  const trimmedFrontmatterTitle = frontmatterTitle?.trim()
  if (trimmedFrontmatterTitle) {
    return { title: trimmedFrontmatterTitle, hasH1: false }
  }

  return { title: filenameStemToTitle(filename), hasH1: false }
}
