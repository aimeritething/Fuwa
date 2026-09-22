---
status: accepted
date: 2026-09-11
---

# Finder opens are buffered on the Rust side and drained by the renderer

A `.md` double-clicked in Finder, chosen through Open With or dropped on the Dock icon opens in Plumo as a Document. All three reach the process as one AppKit call, `application:openURLs:`, which tao turns into `RunEvent::Opened { urls }`. On a launch by document that event fires before `Ready`, so before Tauri's `setup` has created the window and long before the renderer has registered a listener; while the app is running it lands on a live loop with a renderer listening. An event emitted from the `Opened` arm alone would be lost in the first case; a buffer read only at launch would miss the second.

## Decision

Both channels exist, and the buffer is the source of truth. `PendingOpen`, managed on the `Builder` before `run()` so it exists whenever `Opened` fires, holds every Document path Launch Services hands over. The `Opened` arm appends to it and emits `plumo://open-files` as a poke whose payload the renderer does not read. The renderer registers its listener first, then drains the buffer through `take_pending_open` once its Session is restored, and drains it again on every poke. Drains are serialised and `take_pending_open` drains rather than peeks, so a path is opened exactly once whatever the interleaving, and a page reload in dev does not reopen the file. Each path opens the way File → Open Document… does: the active Document's pending edits are written first, an open Document has its Tab activated, and with no Folder open the sidebar collapses.

The drain waits for the Session so that the Folder is known when the sidebar rule runs and the Finder Document, opened last, is the active Tab rather than the Session's. The shell stays unpainted until that first drain has settled, so a launch by document never shows the Session's Tab for a frame.

An `Opened` after `Ready` with no main window (⌘W closed the last one; the app stays in the Dock) recreates the window as a Dock reopen does; its renderer boots, restores the Session and drains the buffer as at launch.

Registration is `bundle.fileAssociations` with the system's own `net.daringfireball.markdown` UTI and no exported type: exporting a second UTI for an extension the system already declares would conflict with it, and a hand-written `CFBundleDocumentTypes` in `Info.plist` would replace, not extend, what the bundler writes. Only `.md` is associated; Image files are not openable from outside Plumo in v0.1. The single-instance plugin is not needed: Launch Services routes these opens to the running process and never starts a second one.

## Consequences

- Nothing here works under `tauri dev`: only a bundled `.app` is a Launch Services handler. The loop is `pnpm tauri build --debug --bundles app`, `lsregister -f` on the bundle, then `open -a` with a `.md`, cold and warm; the release `.app` goes to `/Applications`.
- Before `Ready` no logger is installed, so the `Opened` arm's observation is kept in the buffer and written out at `Ready`. The first observed run confirmed the order the docs predicted: `Opened` before `Ready`.
- If the deep-link plugin is ever added, its `onOpenUrl` will also receive these `file://` URLs and must filter by scheme.
- The mock Folder fixture keeps the same buffer: `seedPendingOpen` plants a launch by document for the next page load (in localStorage, like the Session), `openFromFinder` buffers and pokes with a window event, and `take_pending_open` drains.
