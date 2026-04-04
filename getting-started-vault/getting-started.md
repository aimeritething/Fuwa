---
title: "Getting Started"
type: Note
Related to:
  - "[[What is Laputa]]"
  - "[[Keyboard Shortcuts]]"
  - "[[Laputa Onboarding]]"
---

Welcome to your Laputa vault! This note walks you through the key features so you can start building your personal knowledge graph.

## Editor

Laputa uses a rich markdown editor. Write in plain markdown with headings, lists, checkboxes, code blocks, and blockquotes. Every note has YAML frontmatter at the top (between `---` delimiters) that stores metadata like type, status, and relationships.

Wiki-links connect notes together: type `[[` in the editor to search and link to any note in your vault.

## Types

Types define the kind of entity a note represents — Note, Project, Person, Topic, Task, or any custom type you create. Each type gets its own icon, color, and sidebar section. To create a new type, add a markdown file with `type: Type` in the frontmatter.

## Sidebar

The left sidebar organizes your vault by type. Each type gets its own collapsible section. Special sections include:

- **Inbox** — notes without a type
- **All Notes** — every note in the vault
- **Archive** — archived notes
- **Trash** — deleted notes (recoverable for 30 days)

## Properties

Open the **Inspector** panel (right side) to view and edit a note's properties. Click any value to change it. Use the **+ Add property** button to add custom fields. Properties containing `[[wiki-links]]` become navigable relationships.

## Relationships

Connect notes through frontmatter fields like `Belongs to`, `Related to`, and `Has`. These appear as clickable pills in the Inspector. Backlinks are computed automatically — linking A to B makes B show a backlink to A.

## Views

Views are saved filters that show a subset of your notes. Create a view to see, for example, all active projects or all tasks belonging to a specific project. Views live in the `views/` folder as YAML files. This vault includes an "Active Projects" view that filters for projects with status Active.

## Favorites

Pin frequently used notes to the Favorites section at the top of the sidebar. Toggle a note's favorite status from the Inspector or the command palette.

## Search

Press **Cmd+P** to quick-open any note by title. Use the search bar in the sidebar for full-text search across all notes.

## Command palette

Press **Cmd+K** to open the command palette. From here you can create notes, switch types, toggle views, and access every action in the app.

## AI

Laputa integrates with Claude Code. When Claude Code is running in your vault directory, the status bar shows a green badge. You can use AI to help organize, summarize, and connect your notes.

## Git sync

Your vault is a standard git repository. Use the **Changes** view in the sidebar to see modified files, commit changes, and push to a remote. This means your vault works with any git hosting service for backup and sync across devices.
