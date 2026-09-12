---
status: accepted
date: 2026-09-11
amended: 2026-09-11 (sidebar state and the first paint)
---

# The Rust side owns the Session file

The spec (section 5) wants one `session.json` in the app's config directory, written atomically, debounced about 500 ms after any change and flushed once more on quit, holding both what the renderer knows (the open Tabs, the active Tab, later the Folder, theme and sidebar) and what only the native side knows (the window frame). Tolaria kept these apart: a Rust window-state module and a handful of localStorage keys.

Two owners of one file race each other, and a renderer-side debounce loses whatever changed in the last half second before ⌘Q, because the webview is torn down without a chance to flush.

## Decision

The Rust `session` module owns the file. The renderer hands over its part of the Session (`update_session`) on every change and reads the file back once at launch (`read_session`); it never debounces and never touches `window`. Rust keeps the last renderer state in memory (seeded from the file at launch, so a window move before the renderer reports cannot erase the open Tabs), merges the main window's frame in from its own Moved and Resized events, and does the one debounce, the atomic temp-file-and-rename write, and the flushes: on the window's close request, on `ExitRequested` and on `Exit` (the native Quit item terminates through `applicationWillTerminate`, which reaches the event loop as `Exit`).

The schema is validated in the renderer (`utils/sessionSchema.ts`): an unknown `version` restores nothing and is rewritten by the renderer's first update. The Rust side treats the renderer's part as opaque JSON.

Two consequences of "⌘W with zero Tabs closes the window; Dock reopen restores the Session" are settled here as well:

- On macOS the app stays running after its last window closes (`prevent_exit` on the user-initiated `ExitRequested`), and `Reopen` with no visible window rebuilds the main window from the config and reapplies the saved frame; the renderer boots and restores the Session as at launch.
- Close Tab stays enabled with no Document open (it leaves the manifest's `noteDependent` group), because a disabled native accelerator would swallow ⌘W before the renderer could close the window. The Window menu drops the predefined Close Window item so ⌘W has one owner.

## Consequences

- The renderer's saved-Tab state is at most one IPC call behind the file; there is no window in which a quit loses the last change.
- The saved frame is applied in `setup`, before the first paint; a frame that lands off every screen is ignored. The dev build's centring only happens when no frame was restored.
- In the browser the Folder fixture answers both commands and keeps the Session in localStorage, so a page reload stands in for a relaunch in the smoke specs; the fixture's file has no `window` field.
- The quit flush (pending writes, the error dialog) will need the renderer in the exit path; the natural shape is a Rust `ExitRequested` that prevents, asks the renderer, and exits on its answer. This ADR does not decide that.
- The theme later moved into the renderer's part of the Session: the file's `theme` is the View → Appearance choice, restored at launch and written on every change. Tolaria's localStorage key stays only as a pre-paint mirror for the inline script in `index.html`, so the first frame already has the right appearance; the theme applier rewrites it whenever the choice changes.
- The sidebar followed: `sidebar.collapsed` and `sidebar.width` are the renderer's, restored at launch and written on every change: a toggle, the collapse a lone Document brings, a keyboard step on the edge, or the end of an edge drag (not each pointer move; the Rust debounce is not a reason to send sixty updates a second). A width outside 180–480 is clamped on both the way in and the way out. Unlike the theme there is no pre-paint mirror: the shell is laid out but not painted (`visibility: hidden`) until the restore has settled, so the sidebar and the card appear once, in their restored state, over the window's own background colour. The restore is one read of a small file and always settles, so nothing is hidden for longer than that.
