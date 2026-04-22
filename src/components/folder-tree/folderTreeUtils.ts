export function expandedTreePaths(path: string): string[] {
  const segments = path.split('/').filter(Boolean)
  return segments.map((_, index) => segments.slice(0, index + 1).join('/'))
}

export function mergeExpandedPaths(
  current: Record<string, boolean>,
  paths: string[],
): Record<string, boolean> {
  let changed = false
  const nextExpanded = { ...current }
  for (const path of paths) {
    if (nextExpanded[path]) continue
    nextExpanded[path] = true
    changed = true
  }
  return changed ? nextExpanded : current
}
