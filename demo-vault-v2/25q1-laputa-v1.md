---
aliases: ["Laputa App V1"]
Is A: Project
Belongs to: "[[25q1]]"
Advances: "[[responsibility-learning]]"
Status: Done
Owner: "[[person-luca-rossi]]"
---
# Laputa App V1

## Overview

Following the proof of concept built in [[24q4-laputa-start]], this project delivered the first working version of Laputa with a complete four-panel layout, a property inspector, and a quick-open command palette. V1 represents the transition from "can this work?" to "I can actually use this daily" — the app became the primary interface for browsing and editing the vault, replacing Obsidian for structured data workflows.

The four-panel layout includes a type sidebar (showing all note types like Project, Person, Quarter), a filterable note list, the main editor panel with CodeMirror 6, and a property inspector for viewing and editing YAML frontmatter fields. Quick Open (Cmd+K) enables instant navigation across all ~9,200 vault files. This milestone is a key step toward [[2025-ship-laputa]] and was completed during [[25q1]].

## Goals

- Implement the four-panel layout with resizable panels and responsive behavior
- Build the property inspector panel for viewing and editing frontmatter properties
- Implement Quick Open (Cmd+K) with fuzzy search across all vault files
- Add type-aware sidebar navigation with collapsible sections and file counts
- Achieve sub-200ms navigation between notes (read file, parse frontmatter, render editor)

## Key decisions

- **CodeMirror 6 with reveal-on-focus editing.** The editor shows rendered markdown by default but reveals raw syntax when the cursor enters a block. This hybrid approach was chosen over a pure WYSIWYG editor (TipTap/ProseMirror) because power users need direct access to markdown syntax, especially for frontmatter and wiki-links. The reveal-on-focus model provides the best of both worlds.
- **Frontmatter parsing in Rust, rendering in React.** The Rust backend parses YAML frontmatter and provides structured data to the frontend via Tauri commands. This keeps the parsing fast and consistent, while React handles all presentation logic. The alternative — parsing in JavaScript — would be slower for bulk operations and harder to keep consistent with the Rust-side file operations.
- **Mock layer for browser development.** Built `src/mock-tauri.ts` to return realistic test data when running in a browser without the Tauri backend. This allows UI development and testing in Chrome without starting the full Rust backend, which dramatically accelerated the development loop.

## Notes

- The biggest engineering challenge was making the editor performant with large files. Some vault files are 5,000+ lines, and CodeMirror 6's default configuration struggled with these. Enabling viewport-based rendering and lazy decoration computation solved the performance issues.
- Quick Open search across 9,200 files needed careful optimization. The initial naive approach (filter on every keystroke) was too slow. Implemented a pre-built search index that loads at startup and supports fuzzy matching with sub-50ms response times.
- [[person-david-kim]] tested an early build and identified several UX issues with the property inspector — particularly around editing array-type frontmatter fields (like tags and aliases). His feedback led to a redesigned array editor with inline add/remove controls.
- The mock data layer proved its value immediately. It allowed running Playwright E2E tests and visual verification in Chrome without any Rust toolchain setup. This made CI testing feasible and significantly reduced the feedback loop for UI changes.
- V1 was usable but rough around the edges. The editor lacked many creature comforts (undo/redo state persistence, find-and-replace, syntax highlighting for YAML). These were deferred to [[25q2-laputa-v2]] to keep V1 scope manageable.
