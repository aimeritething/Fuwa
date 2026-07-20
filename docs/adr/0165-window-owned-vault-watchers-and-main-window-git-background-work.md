---
type: ADR
id: "0165"
title: "Window-owned vault watchers and main-window Git background work"
status: active
date: 2026-07-20
supersedes: "0089"
---

## Context

ADR-0089 introduced one native watcher state for the active vault and let every full `App` renderer subscribe to its events. ADR-0123 later restored the full vault graph and watcher scope in secondary note windows for feature parity.

With multiple windows on the same Git-backed vault, each renderer still ran its own automatic Git repository probe, modified-file refresh, remote-status refresh, AutoSync, and AutoGit lifecycle. A save observed by sibling windows also sent each note window through the full vault, folder, view, and Git reconciliation path. Native watcher startup was path-idempotent, but any renderer cleanup called a global stop that removed the watcher for every remaining window.

## Decision

**Keep the full App and vault graph in secondary note windows, while making background ownership explicit.**

- The main window owns automatic Git repository probing, modified-file/status refresh, AutoSync, and AutoGit. Secondary note windows retain manual Git-capable commands but do not start those repeated background loops.
- Every App window still registers its watched vault roots. The native watcher stores a set of owning window labels per root, reuses one `notify` watcher for shared roots, and removes the native watcher only after its final owner unregisters.
- A secondary note window reconciles known watcher paths with `reload_vault_entry`. It updates the affected graph entries and remounts the active editor only when that active clean note changed. Unknown, deleted, moved, or otherwise non-reloadable paths fall back to the full external-refresh reconciler.
- The main window keeps the full external-refresh path so folder, view, Git status, rename, and multi-workspace surfaces remain authoritative.

## Consequences

- Additional note windows no longer multiply continuous Git/status/sync work.
- Editing one note does not force every secondary window to invalidate and rebuild the entire vault graph.
- Closing a note window cannot disable file watching in the main window or another note window.
- Note windows preserve Properties, quick open/search, wikilink navigation, workspace-aware actions, and external-edit convergence from the existing full-App contract.
- If future profiling shows the main window's full reconciliation is itself too expensive, it can adopt a broader incremental graph protocol without changing window ownership.
