export function humanizePropertyKey(key: string): string {
  const spaced = key.replace(/[_-]/g, ' ')
  if (!spaced) return spaced
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
