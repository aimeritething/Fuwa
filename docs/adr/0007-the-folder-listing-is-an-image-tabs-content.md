---
status: accepted
date: 2026-09-11
---

# The Folder listing is an Image Tab's content

A Tab in the kernel is `{ entry, content }`, and every machine around it assumes the content is the file's bytes: the save buffer writes them back, the watcher reads them again after an external change, the error bar retries them. An Image file has none of that. Fuwa shows it and never edits it, and its picture reaches the webview through the asset protocol rather than through the renderer at all.

## Decision

An Image Tab holds no bytes. `content` is `''`, the entry is `fileKind: 'binary'`, and everything the Tab actually shows comes from the Folder listing `list_files` already returns:

- **Byte size**: the listing's `fileSize`, formatted to one decimal.
- **Version**: `modifiedAt` and `fileSize` from the listing, plus the Tab's own count of how many times the watcher has reported the file changed, appended to the asset URL as `?v=…`. Tauri's asset protocol resolves a request by `uri().path()` alone, so the query changes nothing about which file is served and everything about whether the webview serves it from its cache. The count is in there because `modifiedAt` is whole seconds: an overwrite inside the same second that keeps the byte count would otherwise be invisible, and the watcher event is the better witness anyway.
- **Existence**: whether the listing still has the path. That is how a Session entry is checked on restore — a Document proves it survives by being read, an Image file by being listed.

The watcher drives both halves of that without a path of its own: one change inside the Folder refreshes the listing and calls `reloadTab`, which for an Image Tab reads nothing back and only raises the count. And no Tab whose write could be refused ever exists, so the error bar and the quit prompt cannot appear over a picture — by construction, not by a check.

The dimensions are the one thing the listing cannot give. They are the natural size the browser reports on load, which is why the metadata slot is empty until the picture is there.

## Consequences

- The Session restore has to ask the listing about an Image file the moment the Folder is back, before React has the new `files` state. `useFolder` answers from a ref, and `changeFolder` now waits for a change already in flight rather than dropping the second caller, so the ref is settled whichever call asks. Under StrictMode's double-invoked restore effect, the earlier behaviour had the second pass read an empty listing and drop every Image Tab.
- An Image file can only reach a Tab from inside the Folder, which is all v0.1 offers (no Finder open, no drop, no dialog). An Image file outside the Folder would have no listing behind it and would show a size of `0 B`.
- The kernel's editor is told there is no active Document while an Image Tab is active, so its tab-swap machinery blanks rather than parsing a picture, no content flush is registered, and Save, Toggle Rich/Raw and Find in Document stay disabled in the native menu.
- A picture is shown through `<img>`, which renders an SVG's markup and runs none of its scripts. Nothing else in the path can execute file content.
