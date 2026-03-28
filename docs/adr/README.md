# Architecture Decision Records

This folder contains Architecture Decision Records (ADRs) for the Laputa app.

## Format

Each ADR is a Laputa-compatible markdown note with YAML frontmatter:

```markdown
---
type: ADR
id: "0001"
title: "Short decision title"
status: active          # active | superseded | proposed
date: YYYY-MM-DD
superseded_by: "0007"  # only if status: superseded
---

## Context
What situation led to this decision? What forces were at play?

## Decision
What was decided? State it clearly in one or two sentences.

## Alternatives considered
- **Option A** (chosen): pros / cons
- **Option B**: pros / cons
- **Option C**: pros / cons

## Consequences
What becomes easier or harder as a result of this decision?
What triggers re-evaluation of this decision?
```

## Rules

- One decision per file
- Files named `NNNN-short-title.md` (monotonic numbering)
- Once `active`, never edit — supersede instead
- When superseded: update `status: superseded` and add `superseded_by: "NNNN"`
- ARCHITECTURE.md reflects the current state (active decisions only)

## Index

| ID | Title | Status |
|----|-------|--------|
| [0001](0001-tauri-react-stack.md) | Tauri v2 + React as application stack | active |
| [0002](0002-filesystem-source-of-truth.md) | Filesystem as the single source of truth | active |
| [0003](0003-single-note-model.md) | Single note open at a time (no tabs) | active |
| [0004](0004-vault-vs-app-settings-storage.md) | Vault vs app settings for state storage | active |
| [0005](0005-tauri-ios-for-ipad.md) | Tauri v2 iOS for iPad support (vs SwiftUI rewrite) | active |
