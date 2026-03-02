/** Extract the wikilink query that the user is currently typing after [[ */
export function extractWikilinkQuery(text: string, cursor: number): string | null {
  const before = text.slice(0, cursor)
  const triggerIdx = before.lastIndexOf('[[')
  if (triggerIdx === -1) return null
  const afterTrigger = before.slice(triggerIdx + 2)
  // Don't trigger if the query contains ] (already closed) or a newline
  if (afterTrigger.includes(']') || afterTrigger.includes('\n')) return null
  return afterTrigger
}

/** Basic YAML frontmatter structural checks. */
export function detectYamlError(content: string): string | null {
  if (!content.startsWith('---')) return null
  const rest = content.slice(3)
  const closeIdx = rest.search(/\n---(\n|$)/)
  if (closeIdx === -1) return 'Unclosed frontmatter block — add a closing --- line'
  const block = rest.slice(0, closeIdx)
  if (/^\t/m.test(block)) return 'YAML frontmatter contains tab indentation — use spaces'
  return null
}
