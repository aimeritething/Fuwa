interface EditorMutationFlushOptions {
  path: string
  flushPendingEditorContent?: ((path: string) => void) | null
  flushPendingRawContent?: ((path: string) => void) | null
  savePendingForPath?: ((path: string) => Promise<unknown>) | null
}

export async function persistEditorStateBeforeMutation({
  path,
  flushPendingEditorContent,
  flushPendingRawContent,
  savePendingForPath,
}: EditorMutationFlushOptions): Promise<void> {
  flushPendingEditorContent?.(path)
  flushPendingRawContent?.(path)
  await savePendingForPath?.(path)
}
