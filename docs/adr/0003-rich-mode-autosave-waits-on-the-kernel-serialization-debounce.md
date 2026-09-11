---
status: accepted
date: 2026-09-10
amended: 2026-09-11 (Raw mode, AIM-381)
---

# Rich-mode Autosave waits on the kernel's serialization debounce

The spec fixes Autosave at "1.5 s debounce after the last edit, ⌘S forces a flush, disk written first, in-memory state updated only after the write succeeds, buffer kept on failure" (section 3), and CONTEXT.md defines Autosave as writing pending edits "after a short idle delay".

Tolaria reaches disk through two timers in a row. The rich editor serialises its blocks to Markdown 1.5 s after the last keystroke (`useEditorTabSwap`, `RICH_EDITOR_CHANGE_DEBOUNCE_MS`) and only then hands the content to the save hook, whose own 1.5 s timer (`useEditorSave`, `AUTO_SAVE_DEBOUNCE_MS`) schedules the write. In Rich mode a keystroke therefore lands on disk about 3 s later, not 1.5 s.

## Decision

The kernel's serialization debounce **is** the idle wait. When the rich editor delivers content, the shell buffers it through `handleContentChange` and immediately calls `savePending()`, which cancels the save hook's timer and writes now. Everything else in the save hook is unchanged: ⌘S flushes the editor first and reuses the in-flight write, `onNotePersisted` fires only after a successful write, and a failed write leaves the buffer in place and is logged (the error bar is AIM-385).

Raw mode (AIM-381) turned out to have an inner debounce of its own: the carried `RawEditorView` reports 500 ms after the last keystroke. Its reports take the same road as Rich mode's (buffer, then write now) rather than the save hook's timer, so that a refused write is recorded as the Document's error bar (AIM-385) on both surfaces. Raw mode therefore writes about 0.5 s after the last edit, Rich mode 1.5 s; see ADR-0009.

## Consequences

- The observable contract matches the spec's number in both modes; the kernel's hooks are not edited.
- `useEditorSave`'s auto-save timer, its failure toast and `onAfterSave` are bypassed on the Rich-mode path. Fuwa has no toasts, so the shell logs the failure itself; a later ticket that needs `onAfterSave` should call it from the same place.
- Opening another Document while edits are younger than 1.5 s flushes and writes them first, while the closing Document's directory is still the persistence scope (one Document at a time makes every open a close, and spec section 3 flushes a dirty Document before it closes).
