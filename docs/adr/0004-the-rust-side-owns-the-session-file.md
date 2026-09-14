---
status: accepted
date: 2026-09-11
amended: 2026-09-11 (sidebar state and the first paint); 2026-09-12 (review)
---

# The Rust side owns the Session file

The Session is one file, `session.json`, in the app's own config directory: the Folder, the Open Editors with each Document's mode, the active Tab, the theme, the sidebar state and the window frame. One file rather than one store per concern, for three reasons. A restore then reads one moment's state, so the Tabs, the theme and the window it brings back belong together. A Folder never holds Fuwa's configuration (the glossary's definition of a Folder), so the Tab list needs a home outside it, and the config directory is that home for everything else already. And when something goes wrong there is one file to read, and one file to delete to start over. It is written atomically, about 500 ms after any change, and flushed once more on quit.

The pieces have two owners by nature. The renderer alone knows the Tabs, the Folder, the theme and the sidebar; only the native side sees the window frame. Two owners of one file race each other, and a renderer-side debounce loses whatever changed in the last half second before ⌘Q, because the webview is torn down without a chance to flush.

## Decision

The Rust `session` module owns the file. The renderer hands over its part of the Session (`update_session`) on every change and reads the file back once at launch (`read_session`); it never debounces and never touches `window`. Rust keeps the last renderer state in memory (seeded from the file at launch, so a window move before the renderer reports cannot erase the open Tabs), merges the main window's frame in from its own Moved and Resized events, and does the one debounce, the atomic temp-file-and-rename write, and the flushes: on the window's close request, on `ExitRequested` and on `Exit` (the native Quit item terminates through `applicationWillTerminate`, which reaches the event loop as `Exit`).

The schema is validated in the renderer (`src/session/session-schema.ts`): an unknown `version` restores nothing and is rewritten by the renderer's first update. The Rust side treats the renderer's part as opaque JSON.

Rejected:

- **The renderer owns the file** and asks Rust for the frame: the renderer cannot flush at quit, so the last half second of changes is lost, and the frame would cross the boundary twice for nothing.
- **Each side keeps its own store** (the frame in a native window-state file, the rest in the webview's localStorage): two writers if they ever share a file, and localStorage is tied to the webview's data store, invisible to the user and not one file to inspect or delete.

Two consequences of "⌘W with zero Tabs closes the window; Dock reopen restores the Session" are settled here as well:

- On macOS the app stays running after its last window closes (`prevent_exit` on the user-initiated `ExitRequested`), and `Reopen` with no visible window rebuilds the main window from the config and reapplies the saved frame; the renderer boots and restores the Session as at launch.
- Close Tab stays enabled with no Document open (it leaves the manifest's `noteDependent` group), because a disabled native accelerator would swallow ⌘W before the renderer could close the window. The Window menu drops the predefined Close Window item so ⌘W has one owner.

## Consequences

- The renderer's saved-Tab state is at most one IPC call behind the file; there is no window in which a quit loses the last change.
- The saved frame is applied in `setup`, before the first paint; a frame that lands off every screen is ignored. The dev build's centring only happens when no frame was restored.
- In the browser the Folder fixture answers both commands and keeps the Session in localStorage, so a page reload stands in for a relaunch in the smoke specs; the fixture's file has no `window` field.
- How the renderer gets into the exit path, so that ⌘Q can write every pending Document before the process ends, is ADR-0005's decision.
- The theme is the renderer's: the file's `theme` is the View → Appearance choice, restored at launch and written on every change. A localStorage mirror of it exists only for the inline script in `index.html` that paints the first frame before the renderer has read the Session; the theme applier rewrites the mirror whenever the choice changes.
- The sidebar is the renderer's too: `sidebar.collapsed` and `sidebar.width` are restored at launch and written on every change: a toggle, the collapse a lone Document brings, a keyboard step on the edge, or the end of an edge drag (not each pointer move; the Rust debounce is not a reason to send sixty updates a second). A width outside 180–480 is clamped on both the way in and the way out. Unlike the theme there is no pre-paint mirror: the shell is laid out but not painted (`visibility: hidden`) until the restore has settled, so the sidebar and the card appear once, in their restored state, over the window's own background colour. The restore is one read of a small file and always settles, so nothing is hidden for longer than that.
