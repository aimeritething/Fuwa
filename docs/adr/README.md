# Architecture Decision Records

This folder contains Architecture Decision Records (ADRs) for the Laputa app.

## Format

Each ADR is a markdown note with YAML frontmatter. Template:

```markdown
---
type: ADR
id: "0001"
title: "Short decision title"
status: proposed        # proposed | active | superseded | retired
date: YYYY-MM-DD
superseded_by: "0007"  # only if status: superseded
---

## Context
What situation led to this decision? What forces and constraints are at play?

## Decision
**What was decided.** State it clearly in one or two sentences — bold so it stands out.

## Options considered
- **Option A** (chosen): brief description — pros / cons
- **Option B**: brief description — pros / cons
- **Option C**: brief description — pros / cons

## Consequences
What becomes easier or harder as a result?
What are the positive and negative ramifications?
What would trigger re-evaluation of this decision?

## Advice
*(optional)* Input received before making this decision — who was consulted, what they said, when.
Omit if the decision was made unilaterally with no external input.
```

### Status lifecycle

```
proposed → active → superseded
                 ↘ retired      (decision no longer relevant, not replaced)
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
