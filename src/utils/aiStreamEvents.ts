let fallbackStreamEventSequence = 0

function fallbackStreamEventId(): string {
  fallbackStreamEventSequence += 1
  return `${Date.now().toString(36)}-${fallbackStreamEventSequence.toString(36)}`
}

export function createScopedStreamEventName(baseName: string): string {
  return `${baseName}-${globalThis.crypto?.randomUUID?.() ?? fallbackStreamEventId()}`
}
