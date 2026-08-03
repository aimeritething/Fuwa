export function supportsModernRegexFeatures(): boolean {
  try {
    compileRegex('', 'd')
    compileRegex('[[]]', 'v')
    compileRegex('(?<=a)b')
    compileRegex('(?<!a)b')
    compileRegex('(?<label>a)')
    compileRegex('(?<=^|\\s|\\p{P}|\\p{S})a', 'gu')
    return true
  } catch {
    return false
  }
}

function compileRegex(source: string, flags?: string): RegExp {
  return Reflect.construct(RegExp, flags === undefined ? [source] : [source, flags])
}

export function supportsShikiRegexFeatures(): boolean {
  return supportsModernRegexFeatures()
}
