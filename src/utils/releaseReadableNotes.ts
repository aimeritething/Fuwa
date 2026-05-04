type ReadableMarkdownSource = {
  markdown: string
}

type ReadableMarkdownLine =
  | { kind: 'blank' }
  | { html: string, kind: 'bullet' | 'heading' | 'paragraph' }

function escapeHtml(source: ReadableMarkdownSource): string {
  return source.markdown
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function renderInlineMarkdown(source: ReadableMarkdownSource): string {
  return escapeHtml(source)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function renderMarkdownLine(source: ReadableMarkdownSource): ReadableMarkdownLine {
  const line = source.markdown.trim()
  if (line.length === 0) return { kind: 'blank' }

  const heading = line.match(/^(#{1,3})\s+(.+)$/)
  if (heading) {
    const level = heading[1].length
    return { html: `<h${level}>${renderInlineMarkdown({ markdown: heading[2] })}</h${level}>`, kind: 'heading' }
  }

  const bullet = line.match(/^[-*]\s+(.+)$/)
  if (bullet) return { html: `<li>${renderInlineMarkdown({ markdown: bullet[1] })}</li>`, kind: 'bullet' }

  return { html: `<p>${renderInlineMarkdown({ markdown: line })}</p>`, kind: 'paragraph' }
}

function appendRenderedLine(html: string[], line: ReadableMarkdownLine, listOpen: boolean): boolean {
  if (line.kind === 'blank') {
    if (listOpen) html.push('</ul>')
    return false
  }
  if (line.kind === 'bullet') {
    if (!listOpen) html.push('<ul>')
    html.push(line.html)
    return true
  }

  if (listOpen) html.push('</ul>')
  html.push(line.html)
  return false
}

export function renderReadableReleaseNotesMarkdown(source: ReadableMarkdownSource): string {
  const html: string[] = []
  let listOpen = false

  for (const rawLine of source.markdown.split('\n')) {
    listOpen = appendRenderedLine(html, renderMarkdownLine({ markdown: rawLine }), listOpen)
  }

  if (listOpen) html.push('</ul>')
  return html.join('')
}
