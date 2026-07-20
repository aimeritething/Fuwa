import { fileURLToPath } from 'node:url'

const RUST_UNSAFE_USAGE_RULE = 'codacy.tools-configs.rust.lang.security.unsafe-usage.unsafe-usage'

export function isAuditedRustUnsafe(finding, additions) {
  if (finding.rule !== RUST_UNSAFE_USAGE_RULE || !finding.line) return false
  return additions.get(finding.path)?.auditedRustUnsafeLines?.has(finding.line) ?? false
}

export function sarifGateFailures(sarif, additions, repositoryRoot = '') {
  return (sarif.runs ?? []).flatMap((run) => failuresForRun(run, additions, repositoryRoot))
}

function failuresForRun(run, additions, repositoryRoot) {
  const tool = run.tool?.driver?.name ?? 'unknown tool'
  return [
    ...scannerFailures(run.invocations, tool),
    ...(run.results ?? []).flatMap((result) => resultFailure(result, additions, tool, repositoryRoot)),
  ]
}

function scannerFailures(invocations, tool) {
  return (invocations ?? [])
    .filter((invocation) => invocation.executionSuccessful === false)
    .map(() => ({ message: `${tool} did not complete successfully`, tool }))
}

function resultFailure(result, additions, tool, repositoryRoot) {
  const { line, path } = resultPosition(result, repositoryRoot)
  if (!isAddedLine(additions, path, line)) return []
  const failure = {
    line,
    message: result.message?.text ?? 'Codacy issue',
    path,
    rule: result.ruleId ?? 'unknown rule',
    tool,
  }
  return isAuditedRustUnsafe(failure, additions) ? [] : [failure]
}

function resultPosition(result, repositoryRoot) {
  const physicalLocation = result.locations?.at(0)?.physicalLocation
  return {
    line: physicalLocation?.region?.startLine,
    path: normalizedPath(physicalLocation?.artifactLocation?.uri, repositoryRoot),
  }
}

function normalizedPath(uri, repositoryRoot) {
  if (!uri) return ''
  if (uri.startsWith('file:')) return fileURLToPath(uri)
  return uri.startsWith('/') ? uri : `${repositoryRoot}/${uri}`
}

function isAddedLine(additions, path, line) {
  return Boolean(line && additions.get(path)?.has(line))
}
