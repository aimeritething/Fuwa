---
type: ADR
id: "0018"
title: "In-app git divergence and conflict resolution"
status: active
date: 2026-03-19
---

## Context

Laputa uses git for vault sync (via GitHub). When multiple devices edit the same vault, divergence (push rejected) and merge conflicts are inevitable. Previously, users had to resolve these outside the app using command-line git, which broke the self-contained experience and was error-prone for non-technical users.

## Decision

**Handle git divergence, push rejection, and merge conflicts entirely within Laputa's UI: sync status indicators, automatic pull-before-push recovery, a conflict resolver modal, and per-note conflict banners.**

## Options considered

- **Option A** (chosen): Full in-app conflict resolution — pros: self-contained, non-technical users can resolve conflicts, visual diff for each file, Keep mine / Keep theirs per note / cons: complex implementation, must handle all git edge cases
- **Option B**: External tool delegation (open terminal or VS Code) — pros: simpler to implement, leverages existing tools / cons: breaks the flow, assumes user has git knowledge, poor UX
- **Option C**: Conflict-free sync (CRDT-based) — pros: no conflicts by design / cons: fundamentally different architecture, incompatible with standard git, massive rewrite

## Consequences

- `useAutoSync` hook: configurable pull interval, detects divergence, sets `pull_required` status
- `ConflictResolverModal`: shows conflicted files with resolution options (Keep mine / Keep theirs / Manual)
- `ConflictNoteBanner`: inline banner in editor for conflicted notes
- `pullAndPush()`: recovery flow for divergence — pull then auto-push
- Git status popup: shows branch name, ahead/behind counts, Pull button
- Sync states: idle, syncing, pull_required, conflict, error — shown in StatusBar
- All git operations shell out to the `git` CLI (not libgit2) for reliability
- Re-evaluate if CRDT-based sync becomes viable for markdown files
