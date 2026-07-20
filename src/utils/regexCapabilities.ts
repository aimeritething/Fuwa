export function supportsModernRegexFeatures(): boolean {
  try {
    new RegExp('', 'd')
    new RegExp('[[]]', 'v')
    new RegExp('(?<=a)b')
    new RegExp('(?<!a)b')
    new RegExp('(?<label>a)')
    new RegExp('(?<=^|\\s|\\p{P}|\\p{S})a', 'gu')
    return true
  } catch {
    return false
  }
}

export function supportsShikiRegexFeatures(): boolean {
  return supportsModernRegexFeatures()
}
