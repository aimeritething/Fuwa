export function formatIndexedElapsed(lastIndexedTime: number | null): string {
  if (!lastIndexedTime) return ''
  const secs = Math.round((Date.now() - lastIndexedTime) / 1000)
  if (secs < 60) return 'Indexed just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `Indexed ${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Indexed ${hrs}h ago`
  return `Indexed ${Math.floor(hrs / 24)}d ago`
}
