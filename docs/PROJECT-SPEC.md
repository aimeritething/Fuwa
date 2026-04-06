# Laputa App — Personal Knowledge & Life Management App

## Status: V1 Complete! 🎉

## Vision
Custom desktop + mobile app to manage Luca's life — projects, responsibilities, knowledge, people, events. Built around a specific ontology that no existing app gets right. The current Laputa vault (Obsidian, 9200+ markdown files) is the data layer and predecessor — the app gives it a proper UI.

## Tech Stack
- **Desktop**: Tauri (Rust shell + system webview)
- **Frontend**: React + TypeScript
- **Editor**: CodeMirror 6 — live preview with reveal-on-focus (Obsidian/Bear style)
- **Mobile**: Capacitor (wraps same web UI for iOS/Android) — later phase
- **Data**: plain markdown files on disk with YAML frontmatter, git-versioned
- **Core logic**: Rust (file parsing, git ops, indexing) via Tauri commands

---

## Ontology

### Core Entities

#### Year
- Top-level time container
- Has: Quarters, Targets
- Naming convention: `2026` (Laputa legacy: Chinese zodiac names like `2022-tiger`)

#### Quarter
- Time container within a Year
- Has: Projects, Targets
- Natural planning/review cycle

#### Responsibility
- Long-running duty, possibly indefinite
- Has clear and measurable KPIs (via Measures)
- Has an owner (Person)
- Has: Projects, Procedures, Tasks, Measures
- Examples: "Grow newsletter", "Manage sponsorships", "Stay healthy"

#### Measure
- A trackable metric tied to one or more Responsibilities
- Quantitative and observable
- Examples: "Resting heart rate", "Newsletter subscribers", "Monthly revenue", "Sponsorship close rate"

#### Target
- A time-bound goal for a Measure
- Typically quarterly
- Examples: "Resting HR < 55 by Q1 2026", "Reach 100k subscribers by Q2 2026"
- Belongs to: a Quarter (or Year), references a Measure

#### Project
- Has a beginning and an end
- Can't be completed in one sitting
- Has success criteria (key results, described informally in the project page)
- Has a timeline — at minimum a deadline (default: end of quarter)
- Advances one or more Responsibilities
- Has an owner (Person)
- Belongs to: Quarter (primary), Responsibility
- Has: Tasks, Notes

#### Experiment
- Like an unplanned baby project — exploring something promising without expectation of success
- Can't be completed in one sitting
- No strict success criteria or deadline
- Has an owner (Person)
- Examples: "Vibe-coding a stock screener", "Testing a new content format"

#### Procedure
- Recurring piece of work, completable in one sitting
- Has a cadence (daily, weekly, monthly, etc.)
- Belongs to: a Responsibility (usually) or a Project (less common)
- Has an owner (Person)
- Examples: "Weekly sponsorship report", "Morning briefing", "Monthly review"

#### Task
- One-off piece of work, completable in one sitting
- Belongs to: a Responsibility or a Project
- Has an owner (Person)

#### Topic
- An area of interest — no performance expectations
- Things link to Topics for categorization/discovery
- Examples: "AI/ML", "Trading", "Fitness", "Frontend"

#### Note
- A document, tool, resource, or any material helpful to advance work
- Can belong to: Procedures, Responsibilities, Projects (one or many)
- Can be related to: Topics (one or many)
- Examples: evergreen notes, reference docs, templates, bookmarks

#### Person
- A real-world person or an AI agent
- Owner of Projects, Responsibilities, Procedures, Tasks
- Related to Events

#### Event
- Something that happened on a given day, stored in long-term memory
- Examples: conversations, meetings, achievements, personal milestones
- Can be related to: any entity above
- Date-based: one specific day

---

## Relationships Summary

```
Year
  └── Quarter
        └── Project ──→ Responsibility (advances)
        └── Target ──→ Measure ──→ Responsibility

Responsibility
  ├── Project
  ├── Procedure (recurring)
  ├── Task (one-off)
  └── Measure → Target

Project
  ├── Task
  └── Note

Procedure
  └── Note

Note ──→ Topic (categorization)
Event ──→ anything (loose association)
Person = owner of Project, Responsibility, Procedure, Task
```

### Relationship Types
- **Belongs to**: hierarchical parent (Project→Quarter, Task→Project, Procedure→Responsibility)
- **Advances**: Project→Responsibility (why this project exists)
- **Related to**: loose association (Event→anything, Note→Topic)
- **Owner**: Person who is accountable (single owner per entity)

---

## Laputa Legacy Mapping

| Laputa Concept | Life OS Equivalent |
|---|---|
| Year | Year |
| Quarter | Quarter |
| Goal | Target + Measure |
| Project | Project |
| Key Result | Informal in Project page |
| Responsibility | Responsibility |
| Procedure | Procedure |
| Topic | Topic |
| Person | Person |
| Event | Event |
| Evergreen | Note |
| Note (reading notes) | Note |
| Readings | Note |
| Essay | Note (belongs to a Responsibility/Project) |
| Monday Ideas | Note |
| Area | Folded into Responsibility or Topic |
| Month | Removed (Quarter is the planning unit) |
| Journal | Removed or becomes a Note |
| Movie/Restaurant/Hotel | Out of scope (or Topic-linked Notes) |
| Vital | Measure |
| Video/Buckets | Note (belongs to Project/Responsibility) |

---

## UI Design

### Design Reference
- Wireframes: `/Users/luca/OpenClaw/Laputa-app-design.pen`
- Inspiration: Bear Notes, Obsidian

### Core Principle: Type-Agnostic UI
Minimize custom UI behavior per entity type. Everything is a file, everything gets the same treatment. Type only determines which sidebar section an entity appears under (and maybe an icon/color hint). The editor, right panel, and note list behave identically regardless of type.

### Layout: Four Panels

#### 1. Left Sidebar — Navigation
**Filters** (flat, switch the note list view):
- All Notes
- Untagged
- Favorites
- People
- Events

**Section Groups** (expandable, show entity list):
- PROJECTS +
- EXPERIMENTS +
- RESPONSIBILITIES +
- PROCEDURES +

**Topics** (flat list, not nested):
- work
- strategy
- ideas
- research
- drafts
- archive

#### 2. Note List — Middle Panel
- Contextual to sidebar selection
- Title, preview snippet, date, tags as colored pills
- Status/type indicators
- Search bar + create button
- Default sort: last edited (descending)
- Quick type filter pills: `All | Notes | Events | People | ...`
- When viewing a section group entity (e.g. a Project): its own page is **pinned at top**, children listed below

#### 3. Editor — Main Panel
- CodeMirror 6 with live preview (reveal markdown syntax on active line)
- **Tab bar** at top: multiple open notes, closeable, shows parent context
- Title + content only — NO properties/frontmatter shown in editor
- Tags shown as clickable pills below title
- Created/last edited dates below title
- Wikilinks rendered as clickable in-app navigation links
- Frontmatter exists in the file but is hidden from the editor view

#### 4. Right Panel — Inspector
- **Status** pills (Active, Draft, etc.)
- **Properties**: Created, Modified, Author, Word Count, custom properties. Editable — writes to YAML frontmatter.
- **Relationships**: all "belongs to", "related to", "advances" links. Editable.
- **Backlinks**: notes that reference this note
- **Revision History**: git commits for this file — hash, message, author, timestamp. "View all revisions" link.

### Key UI Decisions
- **Editor is sacred** — all metadata/relationships live in the right panel, not above the content. Avoids the Obsidian/Notion problem of properties pushing content down.
- **Everything is a file** — a Project, Responsibility, Topic are all just notes with a type. Clicking one in the sidebar shows its page pinned at top of note list, children below.
- **Topics are flat** — no nesting for v1
- **Saved views / smart filters** — future feature. Saved queries that live under any entity in the sidebar (e.g. "Evergreen 60+ days" under a Procedure). Not in v1.
- **Tasks stay on Todoist** — no task management in v1

## Design Decisions
- **Month/Week are NOT entities** — they're time-based views/filters, not containers. Monthly reviews are a Procedure.
- **Essays, Monday Ideas, Videos, Readings** = Notes (belonging to Responsibility/Project)
- **Movies, Restaurants, Hotels** = Notes attached to Topics
- **Key Results** = informal, embedded in Project pages (not a separate entity)
- **Owner** = single Person per entity (no multi-owner for now)
- **Type-agnostic UI** — minimize type-specific behavior, keep everything consistent
- **Metadata in right panel, not in editor** — frontmatter is hidden from the editor, rendered as editable UI in the inspector

## Dev Workflow

> Full process documented in **`dev-workflow` skill** (`~/.openclaw/skills/dev-workflow/SKILL.md`).
> Below: Laputa-specific details only.

- **Repo**: `~/Workspace/laputa-app/` + GitHub `LucaRonin/laputa-app`
- **Design file**: `~/OpenClaw/projects/Laputa-app-design.pen`
- **Mock layer**: `src/mock-tauri.ts` (realistic test data for browser/Playwright testing without Tauri)

### Laputa-Specific MCPs (for Claude Code)
- **Context7** — up-to-date docs for Tauri v2, CodeMirror 6, React
- **Pencil MCP** — reads the .pen design file

### Key Lesson from M1
M1 passed all tests but showed 0 notes — vault path wrong, error silently swallowed. This drove the mandatory verification workflow now captured in the dev-workflow skill.

---

## V1 Milestones

### M1: Scaffold & Shell ✅ COMPLETE
**Goal:** Empty Tauri + React app that opens a window, reads a vault path, and lists files.
- [x] Init repo at `~/Workspace/laputa-app/`
- [x] Tauri v2 + React 19 + TypeScript + Vite 7 project setup
- [x] Configure Vitest (7 tests), Playwright (2 E2E tests), Rust tests (10 tests)
- [x] Rust backend: `list_vault` command — scans directory, parses YAML frontmatter via `gray_matter` crate
- [x] Rust backend: extracts type (Is A), aliases, Belongs to, Related to, Status, Owner, Cadence, title from H1
- [x] React: four-panel layout (Sidebar 250px, NoteList 300px, Editor flex, Inspector 280px), all resizable
- [x] Tauri mock layer for browser testing (`src/mock-tauri.ts`)
- [x] Screenshot verification via Playwright (`e2e/screenshot.spec.ts`)
- [ ] Push to GitHub (not yet done)

**Git log (5 commits):**
```
e72d66a Add Tauri mock layer for browser testing and visual verification workflow
bc75647 Remove unused Vite scaffold files
7d5c48c Add unit and E2E tests for all panel components
57083ad Add four-panel layout shell with vault scanning on load
6b53cf8 Initialize Tauri v2 + React + TypeScript project with vault scanner
```

### M2: Sidebar & Note List
**Goal:** Navigate the vault via sidebar, see filtered note lists.
- [ ] Sidebar: Filters section (All Notes, Favorites)
- [ ] Sidebar: Section Groups (Projects, Experiments, Responsibilities, Procedures) — populated from frontmatter `type:`
- [ ] Sidebar: Topics — flat list, populated from `Related to` topic links
- [ ] Note list: show title, preview snippet, date, type indicator
- [ ] Note list: sort by last modified (descending)
- [ ] Note list: search (full-text across vault)
- [ ] Note list: type filter pills (All | Notes | Events | People | ...)
- [ ] Clicking a section group entity: pin its page at top, show children below
- [ ] Filesystem watching: live reload when files change externally

### M3: Editor
**Goal:** Open and edit markdown files with CodeMirror 6 live preview.
- [ ] CodeMirror 6 integration with React
- [ ] Live preview: hide markdown syntax, reveal on active line (Obsidian/Bear style)
- [ ] Frontmatter hidden from editor view
- [ ] Tab bar: open multiple notes, close tabs, show parent context
- [ ] Wikilinks rendered as clickable links → navigate in-app
- [ ] Save: write markdown + YAML frontmatter to disk
- [ ] Auto-save (debounced)
- [ ] Basic markdown features: headings, bold/italic, lists, code blocks, links, images

### M4: Right Panel — Inspector
**Goal:** View and edit metadata, relationships, and git history.
- [ ] Properties panel: Created, Modified, Author, Word Count, Status, custom fields
- [ ] Properties editable → writes to YAML frontmatter
- [ ] Relationships panel: Belongs to, Related to, Advances — rendered as clickable links
- [ ] Relationships editable (add/remove)
- [ ] Backlinks: auto-computed from wikilinks across vault
- [ ] Git revision history: show commits for current file (hash, message, author, date)
- [ ] "View all revisions" link

### M5: File Operations & Polish
**Goal:** Create, rename, delete files. Polish for daily-driver use.
- [ ] Create new note (with type selector → sets `type:` in frontmatter, created at vault root)
- [ ] Rename file (updates filename + title)
- [ ] Delete → permanent delete with confirm dialog
- [ ] Keyboard shortcuts (Cmd+N new, Cmd+S save, Cmd+P quick open/search)
- [ ] Quick open palette (Cmd+P) — fuzzy search across all files
- [ ] People and Events filters in sidebar
- [ ] Visual polish: match Bear-inspired design from .pen wireframes
- [ ] E2E tests with Playwright for core flows

---

## Open Questions
- [ ] Migration path from current Laputa vault (legacy cleanup, schema normalization)
- [ ] Multi-user or just Luca + AI agents?
- [ ] How does Brian (and other agents) interact with the data?
- [ ] Mobile: when to start the Capacitor layer?
- [ ] Year/Quarter navigation in sidebar — dedicated section or time-based filter?
- [ ] Home/dashboard view — what does it show?
