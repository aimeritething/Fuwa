---
type: ADR
id: "0013"
title: "BlockNote as the rich text editor"
status: active
date: 2026-02-14
---

## Context

Laputa needed a rich text editor that could render markdown with inline formatting, support custom inline content types (wikilinks), and provide a block-based editing experience similar to Notion. The editor must work inside a Tauri WebView and support a roundtrip pipeline: markdown on disk <-> block tree in editor.

## Decision

**Use BlockNote as the rich text editor with a custom wikilink inline content type, paired with CodeMirror 6 as an alternative raw markdown editor.**

## Options considered

- **Option A** (chosen): BlockNote + CodeMirror 6 — pros: block-based editing, React-native, extensible schema for wikilinks, good markdown import/export, CodeMirror for power users / cons: BlockNote is newer/less mature, markdown roundtrip has lossy edges
- **Option B**: ProseMirror directly — pros: battle-tested, maximum control / cons: much more boilerplate, no block-based UI out of the box
- **Option C**: TipTap — pros: ProseMirror-based with better DX / cons: less block-oriented, custom inline types require more work
- **Option D**: Milkdown — pros: markdown-first / cons: smaller community, less extensible schema

## Consequences

- Custom `WikiLink` inline content type defined via `createReactInlineContentSpec` in `editorSchema.tsx`
- Markdown-to-BlockNote pipeline: `splitFrontmatter → preProcessWikilinks → tryParseMarkdownToBlocks → injectWikilinks`
- Save pipeline: `blocksToMarkdownLossy → postProcessWikilinks → prepend frontmatter → disk write`
- Placeholder tokens (`\u2039`/`\u203A`) used to preserve wikilinks through markdown parsing
- Raw editor mode (CodeMirror 6) available via toggle for direct markdown + frontmatter editing
- `blocksToMarkdownLossy` — some formatting may not survive roundtrip perfectly (known limitation)
- Re-evaluate if BlockNote's markdown fidelity issues become a significant data loss risk
