---
status: accepted
date: 2026-09-11
---

# An open Tab that lost its file is resolved from the Folder listing

Plumo has five rules for a Document that is deleted, renamed or moved while it is open. Four of them need an answer to a question the watcher never asks: is the file still there, and if not, where did it go? The watcher reports changed paths and nothing else — no "renamed from", no "deleted" — because that is all `notify` gives it, and on macOS a renamed folder arrives as the folder's own two paths with nothing about the files inside.

## Decision

Existence comes from the Folder listing, not from the disk. One watcher event refreshes the listing first, and the refreshed listing then decides what happens to each open Tab:

- **The Tab's path is listed**: the file is there, so reload it — unless the Document has a pending Autosave, which a reload would overwrite.
- **The Tab's path has gone**: rule 5's path-prefix match first. A folder above the Tab that is a changed path and is no longer listed has been renamed, so the Tab is looked for at the same place under each other changed path. That is what tells two open Documents of the same name apart when the folder above them is renamed, and it is why nothing folder-shaped is written anywhere else.
- **Failing that**, rule 4's same-name heuristic: the listed files at or under a changed path that still carry the Tab's file name. Exactly one is the file, so the Tab follows it; none or several is rule 3, and the Tab closes. A file renamed in place is deliberately left to this step, which closes its Tab.
- **A Document outside the Folder** is never in the listing, so it is always reloaded, and the refused read is what closes its Tab. Rule 5 already says out-of-Folder Documents have no siblings to resolve against, so an external rename resolves as rule 3 by construction.

Which paths the watcher named decides what is reloaded, but never whether a file still exists: a Tab inside the Folder that the listing no longer holds is gone, even if the event mentioned only the file's new path.

`resolveExternalTabChanges` is that reasoning on its own, over strings: open paths, changed paths, listed paths, and the Folder. It decides; `useDocumentWatcher` carries it out.

Cancelling the Autosave is what makes a close stick. A Tab that goes away takes its buffered edits with it, and — separately — a write to a path with no Tab is refused outright, because the editor flushes its idle debounce as the Tab it belonged to disappears and would otherwise write the file back a moment after the Trash took it.

## Consequences

- A pending Autosave stops a reload but never a close. A Document deleted in Finder mid-sentence loses that sentence, which is deliberate: Plumo never recreates a removed file.
- The listing has to be current the instant the watcher asks, before React has the new state, so `useFolder` answers `listedPaths()` from a ref — the same trick `listsFile` already uses for the Session restore.
- A rename in Finder closes the Tab and the new name appears as a fresh file, while a move to another folder is followed. An ambiguity the prefix cannot settle — two files of the same name appearing in one event — resolves as a close, which is the safe half of it.
- Trash and delete are the same path through the shell: `dropTabsUnder` cancels and closes, whether the Explorer asked for it or the watcher did.
- An Explorer move or rename retargets its Tab before the watcher hears about it, so the event that follows finds the new path listed and only re-reads bytes that have not changed.
