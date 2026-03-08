# Laputa — Product Vision

*Written by Brian based on conversations with Luca Rossi, Feb 2026.*
*This is a living document — update it as the vision evolves.*

---

## Why Laputa exists

Luca has been doing personal knowledge management since university — long before it had a name. Over the years, through two startups, becoming a CTO, and eventually building Refactoring (a newsletter publishing 2-3 articles/week), note-taking evolved from a nice-to-have to a core part of his work. The ability to synthesize ideas, connect concepts across time, and turn accumulated knowledge into articles reliably every week — this only works with a well-structured system.

For years, that system lived in Notion. But over time, the overlap between what Notion offers and what Luca actually needs started to shrink. Notion became simultaneously too narrow (missing specific things he needed) and too wide (full of flexibility he didn't want). The gap became impossible to ignore when AI entered the picture.

## The core insight: local files + Git = AI-native PKM

The fundamental insight behind Laputa is architectural: **a knowledge base made of local Markdown files, version-controlled with Git, is orders of magnitude more AI-friendly than any SaaS-based system.**

Notion's AI struggles with complex workspaces — slow, inaccurate, often failing to understand its own structure. Meanwhile, an AI like Claude or Claude Code working on a local vault of Markdown files can read, edit, and reorganize thousands of documents in seconds, with full comprehension.

This isn't a feature — it's a structural advantage that no Notion redesign can fix. The architecture *is* the product.

Additional benefits that fall out of this choice for free:
- **Version control**: every change is tracked, diffable, reversible
- **Open format**: your knowledge is yours, readable by any tool, forever
- **Remote AI access**: an AI agent can commit to your Git repo from anywhere — your knowledge base becomes programmable
- **Zero lock-in**: if something better comes along, you leave. The trust between Laputa and the user is earned daily, not enforced by proprietary formats

## Why not just use Obsidian?

Obsidian is the obvious comparison. The difference is philosophy:

- **Obsidian** is a blank canvas. Infinitely configurable via plugins, themes, and community extensions. Great for power users who want to build their own system from scratch.
- **Laputa** is opinionated. It ships with a point of view on how to organize knowledge, with sensible defaults that work out of the box — no plugin hunting required.

Obsidian also treats Git as an afterthought (its business model is built around proprietary sync). In Laputa, **Git is a first-class citizen** — the obvious, natural way to sync and collaborate.

## The knowledge ontology

Laputa is built around a clear conceptual model, inspired by PARA but adapted to Luca's real-world usage:

**Two axes:**
1. *One-time* vs *recurring*
2. *Single-session* vs *multi-session*

**Four action types:**
- **Projects** — one-time, multi-session (have a start and end)
- **Responsibilities** — recurring, multi-session (no end, measured by KPIs)
- **Tasks** — one-time, single-session (live in Todoist)
- **Procedures** — recurring, single-session (checklists, routines)

**Knowledge containers:**
- **Notes** — the atomic unit. Can belong to any of the above.
- **Topics** — areas of interest with no performance expectation (like labels/tags). E.g. "front-end engineering", "interior design"
- **Events** — things that happened, tied to a date
- **People** — contacts, with a log of interactions

**Relations** between notes are first-class citizens — not just wiki-links, but typed, bidirectional connections.

## The two-phase knowledge workflow: capture and organize

The ontology above describes the *destination* of a note — what it becomes once it's organized. But before a note reaches its destination, it passes through two distinct phases that Laputa treats as first-class:

### Phase 1: Capture

Capture must be fast, frictionless, and available everywhere. A thought, a saved article, a photo, a Kindle highlight, a voice memo — any of these can be the seed of a future note. The cardinal rule: **never let friction during capture cause a good idea to be lost.**

Capture sources can be:
- Creating a note directly in Laputa (desktop or mobile)
- A Chrome extension that saves a URL or web clip to the vault
- Sharing a photo to the iPhone app
- Readwise or Kindle highlights synced via Git automation
- Any service that can commit a Markdown file to a Git repo

What all captured notes have in common: they land in the vault **unorganized**. They have no `Belongs to:`, no `Related to:`, no connections to the rest of the graph. They are orphans — intentionally.

### Phase 2: Organize

Organization is a deliberate, separate activity. It's when you ask: *"What is this useful for?"*

- Useful for a **Project**? → link it with `Belongs to: [[project/x]]`
- Useful for a **Responsibility**? → link it
- Part of a **Topic** you want to grow over time? → link it with `Related to: [[topic/x]]`
- Part of a **Procedure**? An **Event**? A **Person**? → link accordingly

The rule: **every captured note should eventually connect to at least one actionable container.** If you can't connect it to anything, it's a signal the note isn't useful enough to keep, or that the connection hasn't been discovered yet.

### Inbox: the UI expression of this principle

The Inbox is the section of Laputa that shows all *unorganized* notes — notes that have no outgoing relationships yet. It's the visual representation of "things captured but not yet processed."

The goal: **Inbox Zero**, reached periodically (weekly is ideal). A full inbox is not a failure — it's a queue. An inbox that never empties is a system that isn't working.

The inbox is not a folder. It's a smart filter: any note without a `Belongs to:`, `Related to:`, or other meaningful relationship is automatically in the inbox. Connecting a note to something moves it out, automatically.

This replaces the current "All Notes" section, which has no semantic meaning and provides no guidance on what to do next.

## The deeper mission: AI context scaffolding

Most people today can't effectively share context about their lives with AI. They don't know what to write, how to structure it, or when. The result is that AI assistants — even the best ones — are working with a fraction of the context they need.

Laputa's goal is not just to be an efficient place to store things. It's to provide **scaffolding that makes it easy for people to externalize their knowledge in a structured, AI-readable way** — without having to figure out the system themselves.

The vision: a person who uses Laputa well has built a second brain that any AI can read, reason over, and contribute to. Not the naive "memory" that ChatGPT builds from chat history — but an intentional, curated, structured representation of their work and life.

## Product trajectory

Laputa is designed to grow through three natural stages — not pivots, but extensions of the same foundational model:

**Stage 1: Personal PKM + AI context** *(current)*
A single person manages their knowledge, life, and work in a local vault. The primary collaborator is AI. The vault gives structure to one person's context, making it legible to an AI that can then assist meaningfully across all areas of life and work.

**Stage 2: Independent knowledge workers**
Content creators, freelancers, consultants, indie hackers. People with maximum incentive *and* maximum agency to build their own system. They have a business, clients, projects, responsibilities — and they work alone or in very small teams. The same ontology (Projects, Responsibilities, Procedures, Notes, People, Events) maps perfectly: a content creator has editorial projects, a newsletter responsibility measured by subscriber growth, and a procedure for publishing.

This stage is also where AI collaboration deepens: the AI can see not just your personal notes but your client commitments, your content pipeline, your recurring workflows — and help you manage all of it.

**Stage 3: Small teams**
The same ontology scales to small startups and teams. Companies have projects (with start and end), responsibilities (recurring, measured by KPIs), procedures (owned by someone, with a cadence and expected output), and people. The knowledge structure is identical — only the access model changes: different people should see different subsets of the vault.

This is where the workspace feature becomes meaningful at a team level: workspaces map to vaults, vaults map to access scopes, and each team member has a Laputa instance that shows exactly the information they should see — nothing more, nothing less. Version control gives the team a full audit trail: who changed what, when, and why.

**What makes this trajectory coherent:**
The foundational model — local files, Git-versioned, structured via conventions — is not a compromise. It's what makes all three stages possible without rebuilding the product. Personal use is offline-first and fully private. Team use is Git-collaborative, with access control at the vault/repo level. AI assistance gets better at every stage because the structure it can reason over gets richer.

## Target user (v1)

Developers and technically-minded knowledge workers who:
- Are frustrated with Notion's complexity or performance
- Understand or are comfortable with Git
- Want a system that's AI-native by design, not by bolted-on features
- Value owning their data and formats

Broader audiences (non-developers) are a future consideration — they'll need more onboarding and scaffolding to get started, but the underlying model is designed to work for anyone.

## Current state

A living snapshot of what's built vs what's missing. Updated as features ship.

### ✅ What's working today

**Core editor & notes**
- BlockNote-based editor (block-style, Notion-like) with Markdown files on disk
- Cmd+S save with dirty state indicator (orange dot = modified, green dot = new)
- Word count (frontmatter excluded)
- Rename note by double-clicking tab
- Drag & drop images into editor
- Wiki-links with `[[` autocomplete (2+ chars, max 20 results, colored by note type)

**Navigation & layout**
- 4-panel layout: sidebar / note list / editor / inspector
- Collapsible sidebar and note list (Cmd+1/2/3)
- Tabs with drag-to-reorder
- Quick open (Cmd+P) by title
- Virtual list rendering for NoteList (handles 9000+ notes without lag)

**Properties & types**
- Inspector panel with editable vs read-only properties
- Change note type from Inspector (picker/dropdown)
- Property value text consistent at 12px
- URL properties: click to open in browser, underline on hover
- Bidirectional relationships (Referenced By panel)
- Editable relations: add/remove linked notes
- `type:` as canonical key (removed `is a:` property)

**Sections & customization**
- Sidebar sections with custom icons (290 Phosphor icons, searchable) and colors
- Changes view: click "N pending" in status bar → filtered list of modified notes

**Git integration**
- Commit & push from within the app (saves pending changes first)
- Modified files indicator in status bar, NoteList, and TabBar
- Git history per note (version history)
- Dirty state clears correctly after save/rename

**Vault management**
- Dynamic vault picker (no hardcoded paths)
- Create new local vault or clone/create from GitHub repo
- GitHub OAuth login (device flow)

**Settings & infrastructure**
- Settings panel (Cmd+,): AI provider API keys, stored in app_config_dir
- In-app auto-updater (Tauri updater + GitHub Releases)
- CI: lint, TypeScript, tests (84% frontend coverage, 85%+ Rust), CodeScene ≥9.2
- Universal macOS binary, auto-released on every merge to main

### 🚧 What's missing (Open tasks)

**Bugs**
- Word count still including some frontmatter in edge cases (under investigation)

**Improvements**
- Date picker for date-type properties
- Vista Changes: differentiate new vs modified more clearly
- Relation editing UX polish

**Features (prioritized)**
- Full-text search with semantic support (qmd integration)
- Command palette (Cmd+K) — Raycast-style actions
- `mock-tauri.ts` and `App.tsx` refactor (code health)

**Vision-level features (not started)**
- Onboarding / getting started flow with default note types
- AI-powered features (search, summarization, linking suggestions)
- Graph view
- Mobile / web access via Git remote

## Design principles

1. **Opinionated but not rigid** — ship strong defaults, allow customization where it matters
2. **Convention over configuration** — standard field names (`status:`, `url:`, `start_date:`, `Workspace:`) trigger rich UI behavior automatically. No setup required. Users can override via config files in the vault, but the defaults work out of the box. This is *convention over* configuration, not *convention instead of* configuration.
3. **Git-first** — sync, history, collaboration, and audit trail via Git; no proprietary cloud
4. **AI-native architecture** — local files, open formats, structured by conventions that both humans and AI can read without bespoke instructions. The more a vault follows conventions, the more capable an AI becomes in it.
5. **Zero lock-in** — earn trust daily; the exit door is always open
6. **Ready out of the box** — no plugin hunting, no theme configuration; it just works
7. **Relations as first-class citizens** — connections between notes are as important as the notes themselves
8. **Semantic properties** — certain well-known frontmatter fields (`status:`, `goal:` + `result:`, `start_date:` + `end_date:`) are rendered meaningfully in the UI — as chips, progress indicators, date ranges — not just as plain text in a properties panel. The rendering rules are configurable but sensible by default.
9. **Filesystem as the single source of truth** — the app never owns the data. Cache and UI state are always derived from the files and reconstructible from scratch.
