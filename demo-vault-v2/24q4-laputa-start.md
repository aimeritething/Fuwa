---
aliases: ["Start Laputa App Project"]
Is A: Project
Belongs to: "[[24q4]]"
Advances: "[[responsibility-learning]]"
Status: Done
Owner: "[[person-luca-rossi]]"
---
# Start Laputa App Project

## Overview

After years of managing a personal knowledge vault in Obsidian and finding it increasingly insufficient for the structured, frontmatter-heavy workflow that had evolved, this project kicked off the development of Laputa — a custom desktop application built specifically for the vault's unique requirements. The app is built with Tauri v2 (Rust backend) and React (TypeScript frontend), designed to read and write the same markdown files with YAML frontmatter that the vault already uses.

The motivation was not to replace Obsidian for general note-taking, but to build a purpose-built tool for the structured data layer — types, relationships, properties, and views that Obsidian handles poorly. Laputa treats the vault as a lightweight database of markdown files, offering a four-panel UI with type-aware navigation, property editing, and relational browsing. This project covers the initial spike: architecture decisions, proof of concept, and first working prototype. It advances [[2025-ship-laputa]] as the longer-term goal.

## Goals

- Define the technical architecture: Tauri v2, React 18, CodeMirror 6, Vite
- Build a proof of concept that reads markdown files from a directory and displays them in a panel UI
- Implement frontmatter parsing in Rust (using serde and gray_matter)
- Create the basic four-panel layout: type sidebar, note list, editor, and property panel
- Validate that the app can handle the full vault (~9,200 markdown files) without performance issues

## Key decisions

- **Tauri v2, not Electron.** Tauri produces much smaller binaries, uses less memory, and leverages native webview rather than shipping a full Chromium instance. For a single-user desktop app, Tauri's trade-offs (no cross-platform webview consistency, newer ecosystem) are acceptable. The Rust backend is also more natural for file I/O heavy workloads.
- **Files as the source of truth, not a database.** Laputa reads and writes markdown files directly. No SQLite, no JSON store, no separate database. This means the vault remains portable, version-controllable with git, and readable in any text editor. The cost is that some queries are slower than they would be with a database, but for ~10K files, filesystem operations are fast enough.
- **CodeMirror 6, not ProseMirror or TipTap.** CodeMirror 6 provides the best foundation for a reveal-on-focus markdown editor — showing rendered markdown by default but revealing raw syntax when the cursor enters a block. This is the editing model that feels most natural for power users.

## Notes

- The initial proof of concept took about 3 weeks of focused evening/weekend work. Getting Tauri v2 set up and communicating between the Rust backend and React frontend required working through several documentation gaps — Tauri v2 was still relatively new and the ecosystem was evolving.
- Performance testing with the full vault (~9,200 files) showed that initial directory scanning takes about 2 seconds, and frontmatter parsing adds another 1.5 seconds. This is acceptable for app startup, though indexing will need optimization for real-time search.
- [[person-david-kim]] (who works on developer tools) provided useful early feedback on the UI concept during a podcast conversation. His perspective on tool-building for personal use versus building products helped frame the project's scope.
- The mock data layer (`src/mock-tauri.ts`) was built early and proved invaluable for browser-based testing. Being able to develop and test the React frontend without the Rust backend running dramatically accelerated UI iteration.
- This project transitions directly into [[25q1-laputa-v1]] for the first real milestone of the app.
