---
type: ADR
id: "0166"
title: "Snapshot-first progressive vault startup"
status: active
date: 2026-07-20
supersedes: "0146"
---

## Context

ADR-0146 stopped invalidating the cache during ordinary main-window startup, but `list_vault` still performed Git reconciliation, checked every cached path for deletion, sorted and cloned the complete entry graph, and rewrote the cache before React considered the vault usable. Large mounted graphs therefore remained blocked behind filesystem metadata work even though a complete serialized snapshot was already available.

The editor bundle was also part of the application chunk and secondary mounted workspaces started their scans together. A static startup skeleton hid some of this work without shortening the critical path.

## Decision

**Warm startup is a stale-while-revalidate pipeline with an explicit interactive boundary.**

- `read_vault_snapshot` returns a version- and path-valid cache without Git commands, per-entry filesystem checks, sorting, or cache writes. When Gitignored-file hiding is enabled, the command returns no snapshot so visibility policy remains authoritative.
- React installs the active snapshot and clears the blocking loading state immediately. `list_vault` then reconciles Git changes and filesystem deletions in the background and replaces only that workspace's entries.
- A clean same-commit reconciliation returns cached entries without rewriting the identical cache file.
- Secondary workspaces load after the active workspace and one at a time. A nested mounted workspace reuses entries already supplied by its closest loaded ancestor; duplicate paths prefer the most specific containing workspace.
- BlockNote and editor-only CSS live behind a lazy module boundary that begins loading after the app shell has committed.
- Native launch, React shell, active snapshot, usable active vault, and background reconciliation milestones are measured. Product analytics emits only timings, counts, source, and target status; it never emits vault paths or note content. The warm active-vault target is 800 ms and the React-shell target is 300 ms.

## Consequences

- A valid warm cache makes the note graph usable before Git and filesystem freshness checks finish.
- The snapshot is provisional. Watchers and the background reconciliation remain the authority for changes made after the snapshot was written.
- Cold starts, invalid caches, forced reloads, and Gitignored-hidden mode retain the authoritative scan path.
- Secondary workspaces appear progressively instead of competing with the active vault for disk and CPU.
- Opening the editor may briefly show its existing neutral loading surface while the separate editor chunk resolves.
- Startup regressions can be evaluated from stable PostHog events and the documented targets rather than inferred from the duration of the skeleton.
