export function addedLinesFromDiff(diff, repositoryRoot) {
  const additions = new Map()
  let file = null
  let nextLine = 0

  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ b/')) {
      file = `${repositoryRoot}/${line.slice(6)}`
      if (!additions.has(file)) additions.set(file, new Set())
      continue
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
    if (hunk) {
      nextLine = Number(hunk[1])
      continue
    }
    if (!file || line.startsWith('---')) continue
    if (line.startsWith('+')) {
      additions.get(file).add(nextLine)
      nextLine += 1
    } else if (!line.startsWith('-')) {
      nextLine += 1
    }
  }
  return additions
}

export function biomeGateFailures(report, additions, repositoryRoot) {
  return (report.diagnostics ?? []).flatMap((diagnostic) => {
    const path = resolveDiagnosticPath(diagnostic.location?.path, repositoryRoot)
    const line = diagnostic.location?.start?.line
    if (!path || !line || !additions.get(path)?.has(line)) return []
    return [{
      line,
      message: diagnostic.message ?? 'Biome issue',
      path,
      rule: diagnostic.category ?? 'unknown rule',
      tool: 'Biome',
    }]
  })
}

function resolveDiagnosticPath(path, repositoryRoot) {
  if (!path) return ''
  return path.startsWith('/') ? path : `${repositoryRoot}/${path}`
}
