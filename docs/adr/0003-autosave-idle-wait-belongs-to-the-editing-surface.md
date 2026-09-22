---
status: accepted
date: 2026-09-10
amended: 2026-09-12 (rewritten in place), 2026-09-17 (a landed write shows nothing)
---

# Autosave's idle wait belongs to the editing surface

CONTEXT.md defines Autosave as writing a Document's pending edits to disk after a short idle delay: disk written first, in-memory state updated only after the write succeeds.

Both editing surfaces already wait before they report. The rich editor serialises its blocks to Markdown 1.5 s after the last keystroke (`RICH_EDITOR_CHANGE_DEBOUNCE_MS`) and only then hands the content to the shell; serialising the whole Document and pushing it through `setTabs` on every keystroke is not affordable. The raw editor reports 500 ms after the last keystroke. The save hook ported with the kernel put a 1.5 s timer of its own (`AUTO_SAVE_DEBOUNCE_MS`) between the report and the write, so in Rich mode a keystroke landed on disk about 3 s later, and ⌘S and every Tab switch had two layers to flush.

## Decision

The idle wait is the editing surface's, and there is only one. When a surface reports content, the shell buffers it (`handleContentChange`) and writes it at once (`savePendingForPath`); the save hook has no timer. Disk is written first, the Tab is brought in line and `onNotePersisted` fires only after the write lands, and a refused write leaves the buffer in place and becomes the Document's error bar.

Both surfaces wait the same 1.0 s. The wait is only observable when the process is killed or when another program reads the file; 1.0 s is still longer than a pause between words, so a sentence is not serialised mid-typing, and nothing shorter buys anything. (Today the constants still read 1.5 s and 500 ms; aligning them is a behaviour change made on its own, not part of this decision.)

The save hook keeps only what this path uses: the buffer, the write by path (which joins an in-flight write of the same snapshot and never lets an older write overwrite a newer buffer), discard, the pending query, the persistence scope that confines writes to the open Documents' roots and clears the buffer when it changes, and `onNotePersisted`. The stacked timer, the ⌘S chain with its toasts, `onAfterSave`, path resolution for renames and the `canPersist` switch were unreachable in Plumo and are gone.

Rejected: dropping the serialization debounce and debouncing only the write (every keystroke would serialise the whole Document); keeping two timers and tuning their sum (two layers to flush on ⌘S and Tab switch, with no meaning of their own).

## Consequences

- One number describes Autosave in both modes, and every flush (⌘S, Tab switch, close, quit) flushes the surface and then writes; nothing else waits.
- Plumo's toasts belong to the file actions. Saving never shows one: a refused write is the error bar, and a landed write shows nothing.
- Switching away from a Document while its edits are younger than the idle wait flushes and writes them first, while its directory is still in the persistence scope: a Document's pending edits are written before its Tab closes.
- The kernel's editor hooks (the serialization debounce among them) are not edited.
