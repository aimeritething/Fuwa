# Laputa — Product Roadmap

*Strategic directions, not implementation tasks. Each item here represents a direction that will be broken down into many smaller tasks when the time comes.*

*Updated: March 2026.*

---

## Consolidation sprint (current priority)

Before building new features, the architectural foundations must be solid. Key structural fixes underway:

- Move vault cache outside the vault directory (→ `~/.laputa/cache/`) with atomic writes
- Flip `type:` to canonical field in Rust parser (`Is A:` becomes alias)
- Remove `allContent` from the architecture — derive backlinks from open tabs only
- Remove hardcoded `RELATIONSHIP_KEYS` — detect wikilink fields dynamically
- Fix hardcoded vault path in `resolveNewNote` / `resolveNewType` / `resolveDailyNote`
- Define and enforce the three-source-of-truth contract (filesystem → cache → React state)

These are not features — they are the foundation everything else is built on.

---

## Strategic directions

### 1. Semantic properties

**What:** Conventional frontmatter field names (`status:`, `url:`, `start_date:`, `end_date:`, `goal:`, `result:`) trigger rich UI rendering beyond the Properties panel — chips in the note list, progress indicators in the editor header, date range badges.

**Why:** Notes are not just documents. A Project has a start and end. A Responsibility has KPIs. A Procedure has an owner and a cadence. The app should surface this structure visually, not just store it as plain text.

**Convention over configuration:** the rendering rules ship as sensible defaults. Users can override via `config/semantic-properties.md` in the vault — a plain markdown file, editable from within the app.

**Draft tasks:** created in Todoist. To be prioritized after consolidation sprint.

---

### 2. Default relationships in Properties panel

**What:** The Properties panel shows a set of relationship fields by default — even when empty — guiding the user toward a connected knowledge graph. Defaults include: Belongs to, Related to, Events, People (Type is already shown).

**Why:** A new note starts with a completely empty Properties panel today. There's no guidance on how to connect it. Laputa is opinionated — it should show you the connections that matter.

**Convention over configuration:** the default list is built in, but can be overridden via `config/relations.md` in the vault.

**Draft tasks:** created in Todoist. Needs design discussion (per-type overrides?) before implementation.

---

### 3. Global workspace filter

**What:** A top-level workspace switcher (below the traffic lights) that filters the entire app — sidebar, note list, search — to show only notes belonging to the selected workspace, plus shared notes (those without a Workspace field).

**Why:** A single vault often contains both personal and work content. A workspace filter lets you focus on one context at a time without cognitive overhead.

**How:** Notes opt into a workspace via `Workspace: [[workspace/refactoring]]` frontmatter. Workspace notes are auto-detected from the `workspace/` folder. No setup required.

**Future trajectory:** Workspaces are the seed of a multi-vault, multi-user access control model. In the future, workspaces may map to separate Git repositories — each with their own access permissions. Different people see different workspaces (vaults). Git provides the audit trail. This enables Laputa to grow from a personal tool to a small-team knowledge base without rebuilding the product.

**Draft tasks:** created in Todoist. Lower priority than semantic properties and default relationships.

---

### 4. Inbox and capture pipeline

**What:** An Inbox section that surfaces all unorganized notes — those with no outgoing relationships. Replaces "All Notes" as the primary landing section. Capture integrations (Chrome extension, iPhone share sheet, Readwise sync) feed into the inbox automatically.

**Why:** Capture and organize are fundamentally different activities and should be treated separately. Today Laputa has no concept of an unorganized note — everything lands in the same pool. The inbox makes the unorganized state visible and actionable, creating a discipline: Inbox Zero, reached weekly.

**The inbox as a smart filter:** not a folder. Any note without `Belongs to:`, `Related to:`, or other meaningful relationship is automatically in the inbox. Connecting a note to something removes it from the inbox, automatically.

**Capture integrations (future, each a separate feature):**
- Chrome extension → saves URL/clip as a note to the vault via Git
- iPhone share sheet → quick capture from any app
- Readwise / Kindle highlights → synced via Git automation
- Voice memo → transcribed and dropped into inbox

**Priority:** The Inbox UI is high-value and can be implemented without the capture integrations. Integrations come after.

---

### 5. Mobile apps

**What:** Native apps for iPhone and iPad — not ports of the desktop app, but purpose-built for each form factor.

**iPhone:** Optimized for fast capture. Quick note creation, voice memos, brief thoughts. The primary use case is getting something into the vault quickly while away from the desk. Minimal reading and editing.

**iPad:** A more capable mirror of the desktop experience — reading, editing, navigating the vault. Not a full four-panel layout, but enough to work on notes meaningfully. Think "laptop replacement for light work sessions."

**Why it matters:** Laputa's value as a personal knowledge system depends on being able to capture things wherever you are. Without mobile capture, important notes get lost or end up scattered in other apps.

**Sync:** Git-based, same as desktop. The vault is a Git repo — mobile apps commit and pull like any other client.

**Priority:** After the desktop experience is solid. Not before.

---

## Principles for this roadmap

- **Foundations before features** — a shaky architecture multiplies the cost of every feature built on top of it
- **Convention over configuration** — ship strong defaults, allow customization via vault files
- **File-first** — every strategic direction must be achievable without breaking the markdown-files-on-disk model
- **AI-readable by design** — conventions that humans find intuitive should also be legible to AI agents navigating the vault

---

*For active tasks and bugs, see the Todoist board (Laputa App project).*
*For architectural decisions and design principles, see [ARCHITECTURE.md](./ARCHITECTURE.md) and [VISION.md](./VISION.md).*
