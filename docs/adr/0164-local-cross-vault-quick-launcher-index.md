---
type: ADR
id: "0164"
title: "Local incremental index for the cross-vault Quick Launcher"
status: active
date: 2026-07-19
---

## Context

The global Quick Launcher must search every registered vault while the main window is hidden. The existing `search_vault` command walked the filesystem and reread every Markdown document for every query. Repeating that work once per vault would make launcher latency scale with both vault size and vault count. A separate external search service or persistent index would add lifecycle, privacy, migration, and stale-data concerns.

## Decision

**Keep one process-local, metadata-refreshed search index per vault behind the existing `search_vault` command.**

The first query reads visible Markdown documents into memory. Later queries still enumerate eligible paths so create, rename, delete, Gitignore, and mount changes are discovered, but file content is reread only when size or modification time changes. Search returns an explicit vault-relative path and match category (`exact_title`, `title`, `path`, or `body`) in addition to the existing absolute path, title, snippet, and score.

The renderer calls this command for each available, mounted, opted-in vault and merges results using vault id plus relative path as identity. Per-vault `searchEnabled` lives in the installation-local vault registry and defaults on. The singleton launcher window sends selected notes to the main window through a validated `tolaria://` deep link, reusing the existing vault switch and note navigation path.

Quick capture continues to use the create-only, vault-bounded `create_note_content` command. The renderer previews a unique path, detects collisions without overwriting, and rechecks the destination immediately before creation.

## Alternatives considered

- **Rescan and reread every vault for every keystroke:** no retained state, but unacceptable repeated I/O as vaults grow.
- **Persist a database index:** faster cold starts, but introduces migrations, cleanup, filesystem-watch recovery, and another durable copy of note content.
- **Search only the active vault:** simpler, but does not satisfy cross-vault retrieval or capture.
- **Open results directly from the launcher window:** duplicates the main app's vault-switch and reload state machine.

## Consequences

- Warm queries avoid rereading unchanged note contents while external filesystem changes remain discoverable.
- The index contains note text only in the local app process and is discarded on exit.
- Filesystem enumeration remains proportional to visible Markdown paths; a future watcher-fed invalidation layer can replace that refresh without changing the command contract.
- Search and capture analytics contain only categorical/bucketed metadata, never queries, note text, paths, or vault names.
