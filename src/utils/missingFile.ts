/**
 * Whether a refused read or write says the file is not there any more. The
 * Rust boundary answers "File does not exist" (with or without the path) and
 * the underlying `std::io` error says "No such file or directory"; anything
 * else — a permission, a lock, a full disk — leaves the Tab where it is.
 */
export function isMissingFileError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
  return message.includes('does not exist') || message.includes('no such file')
}
