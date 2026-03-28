---
type: ADR
id: "0017"
title: "Auto-save with 500ms debounce"
status: active
date: 2026-03-19
---

## Context

Manual save (Cmd+S) was the only way to persist note changes. Users could lose work if the app crashed or they navigated away. However, saving on every keystroke would cause excessive disk I/O and vault reloads, especially with the wikilink extraction and frontmatter parsing that happens on save.

## Decision

**Auto-save note content 500ms after the last keystroke via a debounced `useEditorSave` hook. No manual save required, though Cmd+S still works as an immediate save.**

## Options considered

- **Option A** (chosen): 500ms debounce auto-save — pros: no data loss, natural save rhythm, low disk overhead, same save pipeline as manual save / cons: very rapid typing may delay save, 500ms window for potential data loss on crash
- **Option B**: Save on blur/navigate only — pros: fewer writes / cons: data loss on crash during editing, unexpected for users who leave the editor open
- **Option C**: Periodic save (every N seconds) — pros: predictable write pattern / cons: either too frequent (wasteful) or too infrequent (data loss risk)

## Consequences

- `useEditorSave` hook debounces content changes at 500ms
- Same save pipeline: `blocksToMarkdownLossy → postProcessWikilinks → prepend frontmatter → disk write`
- Tab status indicator shows unsaved state during debounce window
- Multi-window: each window has its own independent auto-save via `useEditorSaveWithLinks`
- Cmd+S still available for immediate save (bypasses debounce)
- Re-evaluate if 500ms proves too aggressive for low-powered devices or too slow for data safety
