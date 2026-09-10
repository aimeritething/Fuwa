# Fuwa v0.1 — Specification

Status: **confirmed** in the walk-through on 2026-09-10 (Assemble the v0.1
spec, AIM-371). Assembled from the resolutions of every ticket under the map
*Fuwa v0.1 — Linear-styled Markdown viewer/editor on Tolaria's kernel* (AIM-361).
Implementation is broken into 15 `ready-for-agent` tickets, AIM-377 to AIM-391,
linked by native blocked-by relations; the frontier starts at
[AIM-377](https://linear.app/aimerite/issue/AIM-377).

This document is the hand-off to implementation. Each decision lives in one
ticket; this spec gists them in one place and links back. Where two tickets
disagreed, the later ticket wins and the reconciliation is listed in
[Further Notes](#further-notes) so the walk-through can confirm it.

Vocabulary follows `CONTEXT.md` (Document, Folder, Attachment, Frontmatter,
Image file, Rich mode, Raw mode, Autosave, Explorer, Open Editors, Tab,
Command Menu, Quick Open, Session). Code keeps Tolaria's words: `note` for
Document, `vault` for Folder.

Source tickets:

| Ticket | Type |
|---|---|
| [Charting: v0.1 scope decisions](https://linear.app/aimerite/issue/AIM-362) | grilling |
| [Kernel port inventory from Tolaria](https://linear.app/aimerite/issue/AIM-363) | research |
| [BlockNote UI flavor for Linear styling (Mantine vs shadcn)](https://linear.app/aimerite/issue/AIM-364) | research |
| [Tauri v2 .md file association and open-with on macOS](https://linear.app/aimerite/issue/AIM-365) | research |
| [Shell layout prototype in Linear style](https://linear.app/aimerite/issue/AIM-366) | prototype |
| [Design tokens and editor typography (Linear → Fuwa, plus light theme)](https://linear.app/aimerite/issue/AIM-367) | grilling |
| [Session, tabs, and Folder lifecycle rules](https://linear.app/aimerite/issue/AIM-368) | grilling |
| [Keyboard shortcuts and the Rich/Raw toggle](https://linear.app/aimerite/issue/AIM-369) | grilling |
| [Repo layout and build baseline](https://linear.app/aimerite/issue/AIM-370) | grilling |
| [Port depth: full 41k-LOC surface or a thinner cut](https://linear.app/aimerite/issue/AIM-372) | grilling |
| [Image preview in the Explorer](https://linear.app/aimerite/issue/AIM-373) | grilling |
| [Empty states: Folder open with no Document, and first launch](https://linear.app/aimerite/issue/AIM-374) | grilling |
| [Explorer write-operation UX](https://linear.app/aimerite/issue/AIM-375) | grilling |
| [Collapsed sidebar state and the expand affordance](https://linear.app/aimerite/issue/AIM-376) | prototype |

Repo artifacts: `docs/adr/0001` (port Tolaria verbatim, AGPL-3.0, port depth,
repo baseline), research reports on the `research/*` branches, the settled
shell and token pages on `prototype/shell-layout`.

---

## Problem Statement

Markdown files on a Mac have no good small home. Obsidian and Tolaria assume a
vault with their own semantics (wikilinks, properties, plugins, caches written
into the folder). Code editors show Markdown as source. Preview apps are
read-only. What is missing is a quiet desktop app that opens a `.md` file from
Finder like any document, edits it in place with a rich editor that never
mangles the bytes, and can also open a folder and browse it, while writing
nothing into that folder except the documents themselves and their pasted
images.

## Solution

Fuwa v0.1 is a macOS desktop app (Tauri v2 + React) that:

- opens a Document directly from Finder (double-click, Open With, Dock or
  window drop) or opens one Folder and shows it as a tree in a sidebar;
- edits Documents with Tolaria's editor kernel, ported verbatim: Rich mode
  (BlockNote) as the everyday view and editor, Raw mode (CodeMirror) for the
  exact bytes, with caret-preserving switching between them;
- autosaves to disk first, 1.5 s after the last edit, and never shows a dirty
  indicator or a save prompt in the normal path;
- looks like the Linear app: dark by default, light and system themes, one
  floating editor card, hairline borders, Inter Variable and JetBrains Mono,
  indigo accent;
- keeps its own state (the Session) in the app's config directory and writes
  nothing into the Folder except Documents and Attachments.

Nothing in v0.1 is signed, notarized, updated, synced, indexed or searched by
content. It is a local build for personal use.

## User Stories

### Opening things

1. As a Mac user, I want to double-click a `.md` file in Finder and have it open in Fuwa, so that Markdown behaves like any other document type.
2. As a Mac user, I want "Open With → Fuwa" and drops onto the Dock icon to work, so that Fuwa is a real document handler.
3. As a Mac user, I want to drop a `.md` file onto the Fuwa window to open it, so that I do not need Finder navigation.
4. As a user opening a lone file, I want the sidebar to collapse so the Document fills the window, so that a single file feels like a single document.
5. As a user, I want File → Open Folder… (⌘O) to root the sidebar at a directory, so that I can browse a set of Documents.
6. As a user, I want File → Open Document… (⌘⇧O) to open one file through the system dialog, so that I can open files outside the Folder.
7. As a user, I want a Document outside the Folder to get a normal Tab with its parent folder shown dimmed, so that I always know where a file lives.
8. As a user, I want Fuwa to remember the last Folder, the open Tabs, the active Tab, each Tab's mode, theme, sidebar and window geometry, so that relaunching resumes where I left off.
9. As a user whose Folder has moved, I want a quiet "Folder not found" line above the Open Folder button rather than a dialog, so that a missing folder is a fact, not an error.
10. As a user, I want Tabs whose files vanished to be dropped silently on restore, so that I never see placeholder Tabs.
11. As a user, I want File → Close Folder to return to the no-Folder state, so that I can leave a project cleanly.

### Editing

12. As a writer, I want a WYSIWYG Rich mode as the default, so that I read and edit the same surface without a separate preview.
13. As a writer, I want a Raw mode showing the exact bytes on disk, so that I can fix anything the rich editor cannot express.
14. As a writer, I want ⌘\ and a segmented control to switch Rich and Raw with my caret preserved, so that switching is cheap.
15. As a writer, I want each Tab to remember its own mode while open and across restore, so that Raw is a per-Document choice.
16. As a writer, I want GitHub-flavored Markdown plus math, Mermaid, callouts, highlights, HTML blocks, tldraw whiteboards and highlighted code, so that the dialect matches what I already write.
17. As a writer, I want Frontmatter preserved byte-for-byte and hidden in Rich mode behind a small "frontmatter · N keys" badge that switches to Raw, so that metadata never gets rewritten.
18. As a writer, I want invalid Frontmatter to force Raw mode with the Rich segment disabled and a tooltip explaining why, so that Rich never silently discards bytes.
19. As a writer, I want Autosave 1.5 s after my last edit and ⌘S to force it, so that I never think about saving.
20. As a writer, I want disk written before memory is updated, so that a crash can never lose a completed save.
21. As a writer, I want no dirty dot and no close prompt, so that closing is one act.
22. As a writer, I want a write failure to keep the Tab open with an error bar offering Retry and Discard changes, so that a failed save is visible and recoverable.
23. As a writer, I want quitting to flush every pending save and, if one fails, to be asked Retry or Discard and quit, so that quitting never loses edits silently.
24. As a writer, I want a Document changed on disk by another app to reload when I have no pending edits, so that Fuwa follows external tools.
25. As a writer, I want a pasted or dropped image to land in `attachments/` beside the Document, so that images travel with the text.
26. As a writer, I want ⌘F to find in the current Document in both modes, so that long files stay navigable.
27. As a writer, I want ⌘⇧V to paste without formatting, so that copied web text becomes plain Markdown.
28. As a writer, I want all of Tolaria's and BlockNote's editing shortcuts unchanged, so that muscle memory carries over.

### The sidebar and Explorer

29. As a user, I want an Explorer tree of Documents, sub-folders and Image files, hiding everything else, so that the tree is only what Fuwa can show.
30. As a user, I want a single click on a Document or Image file to open a real Tab, so that there are no preview tabs to lose.
31. As a user, I want the selected Explorer row to follow the active Tab, so that the tree always shows where I am.
32. As a user, I want an Open Editors group listing every open Tab, hidden when nothing is open, so that the sidebar stays quiet.
33. As a user, I want ⌘N to create `Untitled.md` immediately where my selection points and start an inline rename, so that new Documents exist before I name them.
34. As a user, I want New Folder to work the same way, so that structure is cheap to create.
35. As a user, I want Rename… from the context menu to edit the file stem in place with the extension locked, so that I cannot rename a Document out of the tree.
36. As a user, I want rename collisions and invalid names reported inline under the row, so that I fix them without a dialog.
37. As a user, I want Move to Trash on files and folders with no confirmation, so that delete is fast and the Trash is my safety net.
38. As a user, I want to drag a Document or Image file onto a folder to move it, so that reorganising does not need Finder.
39. As a user, I want a move that would overwrite to be refused with a toast, so that nothing is clobbered.
40. As a user, I want Reveal in Finder and Copy Path on any row's context menu, so that Fuwa hands off to the system cleanly.
41. As a user, I want folders first then files, case-insensitive, so that the tree reads like Finder.
42. As a user, I want an open Document renamed or deleted in the Explorer to have its Tab retargeted or closed, so that Tabs never point at ghosts.
43. As a user, I want an open Document deleted or renamed outside Fuwa to close its Tab or follow a same-name move, so that Autosave never resurrects a file I removed.
44. As a user, I want ⌘[ to collapse and expand the sidebar, so that focus mode is one key.
45. As a user, I want the collapsed window to be one edge-to-edge surface with a sidebar icon next to the traffic lights, so that the affordance to come back is obvious.

### Images

46. As a user, I want clicking an Image file to open it in a Tab fitted to the card, so that reference images sit beside the text.
47. As a user, I want the image Tab's path row to show dimensions and size with Open ↗ and Copy path, so that I can hand the file to a real image app.
48. As a user, I want an image edited elsewhere to reload in its Tab, so that Preview.app round-trips work.

### Finding and commanding

49. As a user, I want ⌘P to fuzzy-match Document and Image file names in the Folder, so that I can jump to a file by name.
50. As a user, I want ⌘↵ in Quick Open to open in Raw, so that I can go straight to source.
51. As a user, I want ⌘K to open a Command Menu listing every menu-bar command plus file names, so that I never hunt the menu bar.
52. As a user, I want ⌘⇧[ / ⌘⇧] and ⌘1–9 to move between Tabs, so that Tabs are keyboard-first.
53. As a user, I want ⌘W to close the Tab, or the window when no Tab is open, so that ⌘W means "close" consistently.
54. As a user, I want a native macOS menu bar with Fuwa, File, Edit, View and Window, so that every command is discoverable.

### Look and feel

55. As a user, I want Fuwa to look like the Linear app in dark mode by default, so that it feels like a precision tool.
56. As a user, I want light and system themes selectable from View → Appearance, so that the app follows my desk.
57. As a reader, I want a 680px prose column at 15px/1.6, so that long Documents are comfortable.
58. As a user, I want four quiet empty states (no Folder, first launch, Folder with no Tab, empty Folder), so that an empty window still tells me what to do.

### Ownership and trust

59. As a user, I want Fuwa to write nothing into my Folder except Documents and `attachments/`, so that my files stay portable.
60. As a user, I want no telemetry, analytics, crash reporting or network access, so that a local editor stays local.
61. As a developer, I want the source under AGPL-3.0-or-later with Tolaria attributed, so that the port is honest.
62. As a developer, I want Tolaria kept as an upstream remote with its paths and identifiers, so that upstream fixes cherry-pick cleanly.

## Implementation Decisions

Organised by the sections the map asked for. Each heading names its source
ticket(s); the ticket comment holds the full reasoning.

### 1. Product scope

Source: *Charting: v0.1 scope decisions*; refined by later tickets.

- **Platform**: Tauri v2 desktop app, macOS only. Product name Fuwa,
  identifier `com.aimerite.fuwa` (`.dev` suffix in dev). Single window.
- **Content model**: a Document is a `.md` file on disk; Fuwa never owns a copy
  that outlives the Session. One Folder at a time. Image files (twelve
  extensions: apng, avif, bmp, gif, ico, jpeg, jpg, png, svg, tif, tiff, webp)
  are shown, never edited. All other files are invisible.
- **Folder hygiene**: Fuwa writes only Documents and `attachments/` into a
  Folder. No config, no cache, no marker directories.
- **Distribution**: local unsigned `.app` build for personal use. No signing,
  notarization, auto-update, Windows or Linux.
- **License**: AGPL-3.0-or-later, because the kernel is a verbatim copy of
  Tolaria (ADR-0001).
- **No network**: no telemetry, analytics, crash reporting, AI, or remote
  fetches. UI copy is English only.

### 2. Shell and layout

Source: *Shell layout prototype in Linear style* (variant B "Linear-native"),
corrected by *Empty states*, *Keyboard shortcuts*, *Design tokens*, and
*Collapsed sidebar state*. Settled pages: `prototypes/shell/b-linear--*.html`
and `prototypes/tokens/linear-app-values.html` on `prototype/shell-layout`.

**Window**

- Hidden native title bar (`titleBarStyle: Overlay`, `hiddenTitle`), macOS
  traffic lights drawn by the system at the window's top-left. The inset is set
  once at window creation and chosen so the lights sit vertically centred in a
  44px row. Default 1200×800, minimum 640×480, background `#09090a`.
- No bottom status bar. Save state lives in the path row.

**Expanded layout**

- The sidebar sits directly on the canvas (no border, no separate surface).
  Its top row is 44px so the traffic lights keep one y in both states; the
  sidebar-collapse icon sits at that row's right end.
- The editor is a floating card: content surface `#111212` dark, 12px radius,
  hairline ring, 8px margin top/right/bottom.
- Inside the card, top to bottom: the **tab bar** (44px, tabs only, pill-shaped,
  selected tab raised), the **path row**, then the content.
- **Path row**, left: breadcrumb `Folder › sub › Document.md`, the full
  in-Folder path, intermediate segments muted, file name in body colour, plain
  text with no click navigation. Out-of-Folder files show `Parent › name` with
  the parent dimmed, the same rule Open Editors uses. Right, in order: mono
  `saved 2s ago`; mono `frontmatter · N keys` (click switches to Raw); the
  `Rich | Raw` segmented control.
- **No frontmatter properties are rendered in Rich mode.**
- The prose column is 680px, centred, 56px horizontal padding.

**Sidebar sections**

- The prototype's `fuwa ▾` header row is removed.
- **Open Editors**: a group with a quiet "Open Editors" label, one row per open
  Tab (Document or Image file), close affordance on hover, the active row
  selected. Out-of-Folder files show the dimmed parent folder name after the
  file name. **Not rendered at all when zero Tabs are open.**
- **Explorer**: a quiet "Explorer" label with hover-only header actions ("+"
  new Document, "…" holding exactly New Folder · Collapse All · Reveal in Finder ·
  Close Folder), then the tree. The Folder's name is the root node, expanded by
  default. Chevrons on folders, 14px indent per level, file icon for Documents,
  image icon for Image files.

**Collapsed layout ("Flush")**

- The card goes edge-to-edge: no margins, no radius, no ring. The window is one
  content surface. The traffic lights now sit inside the tab bar's 44px row.
- The sidebar icon (same glyph as the collapse icon) sits right after the
  traffic lights, before the first tab, with a mono tooltip `Show sidebar ⌘[`.
  ⌘[ and View → Toggle Sidebar work in both states. No hover strip, no peek.
- Breadcrumb unchanged. Only the two end states are specified; the transition
  is implementation's call.
- Opening a Document with **no Folder open** collapses the sidebar. With a
  Folder open, the sidebar stays as it is.

**Empty states** (source: *Empty states*)

| State | Sidebar | Card |
|---|---|---|
| No Folder (identical on first launch; no one-time hint) | Under "Explorer": "No folder open", one line of copy, an indigo **Open Folder ⌘O** button, "or drop a .md file onto the window". On restore with a missing Folder, "Folder not found: <path>" above the button. | Dim "Fuwa" wordmark and one mono hint `⌘O open folder`. Tab bar and path row hidden. |
| Folder open, no Tab | Explorer tree; Open Editors not rendered | Dim wordmark, hints `⌘N new document · ⌘P quick open`. Tab bar and path row hidden. |
| Empty Folder (no `.md` anywhere under the root) | One muted line in the tree area: `No documents yet · ⌘N`. No button. Disappears on first ⌘N. | As "Folder open, no Tab". |
| No Folder, out-of-Folder Tabs open | Collapsed on open. If expanded: Open Editors at the top, then "Explorer" with the "No folder open" block. | The Document, normally. |

**Quick Open / Command Menu palette** (source: *Shell layout prototype*,
*Keyboard shortcuts*, *Design tokens*)

- Centered, top ≈24%, 560px wide, popover surface, 12px radius, ring plus large
  shadow over a dimmed backdrop. 56px input row, 17px light text, no search
  icon, no group header.
- Rows 40px: icon, name with the matched substring emphasised, parent path
  muted, a right-aligned type column (`Document`, `Image`, `Command`).
  Command rows show the shortcut on the right in Inter 11px/500 (the menu
  sub-theme), not mono.
- Footer, mono: `↵ open · ⌘↵ open in Raw · esc close`. On an Image file, ⌘↵ is
  a plain open.

### 3. Editor kernel and dialect

Source: *Charting*, *Kernel port inventory*, *Port depth*, *BlockNote UI
flavor*, ADR-0001.

**What the kernel is**: Tolaria's editor, copied verbatim at commit `ee768ac`:
BlockNote Rich mode, CodeMirror Raw mode, the ADR-0105/0109 Markdown-to-blocks
pipeline (worker parser, progressive block mounting, generation-checked swaps,
parsed-block LRU), the ADR-0116 serialization owner, Rich/Raw switching with
caret mapping, debounced disk-first Autosave, and the durable-Markdown bridges.

**Port depth rule**: port the full surface verbatim and cut only at feature
seams; never thin a group by depth. Whole features removed: wikilinks (UI
only), sheets, AI, inspector, vault expressions, title-based rename and the
Rust wikilink rewriter, sandboxed-script HTML blocks and their protocol,
remote-image paste, all six optional Rust commands (one exception below).
Budget: ~40–41k LOC frontend (~240 files), ~3.1k LOC Rust, ~22k LOC carried
tests, 37 npm runtime deps, 6 mandatory pnpm patches, 13 cargo crates.

**Dialect**: GitHub-flavored Markdown plus inline and block math (KaTeX),
Mermaid, callouts (`> [!NOTE]` family), `==highlight==` marks, HTML blocks
(static, sanitized only), tldraw whiteboards (lazy chunk), shiki-highlighted
code blocks (extra grammars as per-language dynamic imports). **No wikilinks**:
the wikilink text utility and the inert schema spec are kept so `[[…]]` text
round-trips losslessly, with a plain-text renderer and no UI.

**Group-by-group calls**

1. Parse pipeline and caches: verbatim. A ~20-line Fuwa event bus replaces
   Tolaria's note-content cache for the parsed-block preload; the shell fires
   it for the active Tab only.
2. Rich-editor extensions and formatting surface (74 files): all copied,
   including collapsed sections, block selection and arrow ligatures. Only two
   wikilink import lines and the remote-image-paste hook are deleted.
3. Serialization owner and durable blocks: verbatim.
4. Block renderers: tldraw ships lazily; HTML blocks static-sanitized; Mermaid
   dynamic import; KaTeX stays a static import in v0.1 (see Further Notes).
5. Rename: filename rename and move-to-folder only; a Document is its
   filename. No rename transaction (a rename is one `fs::rename`).
6. Raw editor: verbatim minus wikilink autocomplete and remote-image paste.
   The find bar stays.
7. Images: verbatim minus the attachment-rename sync. The file preview is
   trimmed to its image branch.
8. Theming: the editor stylesheet and theme JSON are copied verbatim and
   re-valued in place; variable names are not renamed.
9. Editor shell: the top-level editor component and content layout are
   **rewritten** at ~600 LOC; everything they mount is copied.
10. Stubs (i18n as an English map, no-op telemetry and analytics, mock Tauri,
    startup performance, app command dispatcher) keep Tolaria's module paths so
    carried tests resolve. The fat vault-entry type is kept and populated from
    Fuwa's `list_files`. The path-boundary module is rewritten around one root.

**BlockNote UI flavor**: `@blocknote/shadcn`, not Mantine. Its chrome is themed
by plain CSS variables that map onto Linear tokens; it drops ~190 KB of Mantine
CSS; Tolaria touches Mantine in three files, seven CSS lines and six test mocks
(1–2 days to migrate). The shadcn tooltip is overridden to the menu surface.
The Mantine provider wrapper and the block-type select are the rewrite points.

**Frontmatter**: hidden in Rich mode behind the `frontmatter · N keys` badge;
shown in full in Raw mode; preserved byte-for-byte. Invalid Frontmatter forces
Raw and disables the Rich segment with tooltip "Fix the frontmatter to use Rich
mode".

**Rich/Raw mode**: per Tab, default Rich for any freshly opened Document, stored
in the Session. This deviates from Tolaria's global per-vault mode; the
`useRawMode` hook changes where it reads state, file structure unchanged.

**Autosave and save**: Tolaria's save contract unchanged: 1.5 s debounce, ⌘S
forces a flush, disk written first, in-memory state updated only after the
write succeeds, buffer kept on failure. Renaming, deleting or closing a dirty
Document flushes first.

**Watcher**: the Folder is watched; out-of-Folder Documents get their own
watch. A clean Document reloads on external change; a dirty one is left alone.
Image Tabs reload on external overwrite.

**Images and drops**: pasted or dropped images are copied to `attachments/`
beside the Document (Tolaria's convention). Drops arrive through Tauri's
**native drag-drop event** (`dragDropEnabled: true`; WKWebView then never fires
HTML5 `drop` for external files): a dropped `.md` path opens a Document, an
image over a Document Tab becomes an Attachment, an image over an Image Tab or
with no Tab is ignored with no toast.

**File association and open-with**: `bundle.fileAssociations` with UTI
`net.daringfireball.markdown` (no exported type, no hand-written
`CFBundleDocumentTypes`). Finder, Open With and Dock opens arrive as
`RunEvent::Opened`, which fires before `Ready`: paths are buffered in managed
state and drained by the frontend through `take_pending_open` after it has
subscribed. The single-instance plugin is not needed on macOS. Registration
exists only in a built `.app`, never under `tauri dev`. The exact
`Opened`-before-`Ready` order is derived from tao and Apple docs, not yet
observed: log it on first implementation.

### 4. Explorer and file operations

Source: *Explorer write-operation UX*, *Image preview in the Explorer*,
*Charting*, *Session rules*.

**Engine**: the Explorer tree is **rewritten** (~400–500 LOC: rows for folder,
Document, Image file and root; tree body; creation and rename rows). Tolaria's
folder tree is folders-only and cannot hold nested Documents. Copied verbatim:
the inline-rename input hook (Enter/blur double-fire guard), the disclosure
hook, tree and folder-action utilities (Tab prefix rewrite after folder
rename), the note drag-drop helpers (type-section branch stripped), and the
Rust folders, filename-rules and trash modules. Listing comes from a Fuwa-owned
`list_files` command returning path, kind, `modifiedAt` and `fileSize`, because
Tolaria's vault scanner is not portable. Hidden files, `.git`, `node_modules`
and unknown binaries are excluded.

**Selection**: one selected row, and it follows the active Tab (highlighted and
revealed when inside the Folder). Clicking a folder row selects it without
changing the active Tab. Right-click never changes selection and never opens a
Tab; the context menu acts on the row under the cursor.

**Where a new Document lands** (context menu, header "+", ⌘N, one rule): folder
or root row selected → inside it; Document row selected → in its parent;
nothing selected → Folder root. Not configurable.

**Creation**: `Untitled.md` is written to disk immediately, a Tab opens, and the
new row enters inline rename with the stem selected. Collisions suffix Finder
style with a space: `Untitled 2.md`, `Untitled 3.md`. Creation never errors.
Folders: `New Folder`, `New Folder 2`, same pattern. **With no Folder open, ⌘N
is disabled**; v0.1 has no Save-As creation path.

**Rename**: in-row inline input at the row's indent, editing the **stem only**;
the extension is dim static text and is never editable. Enter commits, Escape
cancels, blur commits if changed and cancels silently if unchanged or empty.
Trigger: context menu Rename… only (no Enter, F2, or double-click). Errors are
inline: a red hairline ring and one muted line under the row ("A Document named
X already exists"). `/` is blocked as typed; control characters, leading `.`,
trailing space or dot and reserved names report on commit. After a commit the
row re-sorts, stays selected, scrolls into view, and the Tab title updates.
Rename and move are a single `fs::rename`; no transaction, no marker.

**Delete**: Move to Trash via the `trash` crate for files and folders alike, no
confirmation. Tabs under a deleted folder close. A dirty open Document flushes
first.

**Drag-and-drop move**: Document and Image rows drag onto a folder row or the
root row; folder rows are not draggable. A name collision refuses the move with
a toast ("docs/adr already has a.md"); no auto-suffix. Tabs retarget.

**Sort**: folders first, then files, each case-insensitive by name.

**Context menu**: a custom Linear-styled menu on shadcn/Radix `ContextMenu`
(not the native macOS menu; Tolaria's positioned div is dropped). Items, in
order (─ = separator):

| Row | Items |
|---|---|
| Document | Rename… · Move to Trash · ─ · Reveal in Finder · Copy Path |
| Image file | Rename… · Move to Trash · ─ · Reveal in Finder · Copy Path |
| Folder | New Document · New Folder · ─ · Rename… · Move to Trash · ─ · Reveal in Finder · Copy Path |
| Root (the Folder's name) | New Document · New Folder · ─ · Reveal in Finder · Copy Path |
| Empty area below the tree | New Document · New Folder (at root) |

No Open in Raw, Duplicate, or Copy Relative Path. Reveal in Finder and Copy
Path exist only here; they are not manifest commands and do not appear in the
Command Menu.

**Image files**: clicking one opens a real Tab (image icon, filename, close on
hover, one Tab per path, positional successor rule, restored from the Session).
The body is Tolaria's fit: centred, padded to the prose column's horizontal
padding, scaled down to fit, never scaled up, no zoom, no scroll. SVG renders
through `<img>` (no scripts). The path row shows the breadcrumb on the left
and, on the right, a mono metadata line `1920 × 1080 · 240 KB` (dimensions from
the natural size after load, nothing before; byte size from `list_files`, one
decimal) plus two ghost buttons **Open ↗** (default app) and **Copy path**. No
`saved…`, no Frontmatter badge, no Rich/Raw. The Fuwa-authored image view is
~80 LOC over the copied image and fallback preview pieces. No entry point opens
an Image file from outside Fuwa in v0.1.

### 5. Session rules

Source: *Session, tabs, and Folder lifecycle rules*, widened by *Image preview*.

**Session file**: one `session.json` in Tauri's app config directory
(`~/Library/Application Support/com.aimerite.fuwa/`). No separate settings
file; theme lives here. Written atomically (temp file + rename), debounced
~500 ms after any change, flushed once more on quit. Schema (from the grilling;
paths absolute):

```json
{
  "version": 1,
  "folder": "/Users/x/notes",
  "openEditors": [
    { "path": "/Users/x/notes/a.md", "mode": "rich" },
    { "path": "/Users/x/notes/cover.png" }
  ],
  "activePath": "/Users/x/notes/a.md",
  "theme": "dark",
  "sidebar": { "collapsed": false, "width": 260 },
  "window": { "x": 0, "y": 0, "width": 1200, "height": 800 }
}
```

`folder` and `activePath` may be null. `openEditors` order is Tab order.
`mode` is `rich | raw` and is omitted on Image file entries (kind is derived
from the extension; a stray `mode` is ignored). `theme` is
`system | dark | light`, default `dark` on first launch. **Not persisted**:
caret, scroll, Explorer expanded-folder set (every restored Document opens at
the top; the Explorer opens with only the root expanded). Tolaria's window-state
Rust module and localStorage keys are consolidated into this one file.

**Restore**: Folder missing → drop it, show the "Folder not found: <path>" line
in the Explorer empty state until any Folder is opened, rewrite the Session with
`folder: null` at once; Tabs whose files still exist are restored regardless.
Document missing → drop its Tab silently; if it was active, the next surviving
Tab in order becomes active.

**Folder and Tabs**

- A Document or Image file has at most one Tab; opening it again activates the
  existing Tab.
- Closing the active Tab activates the Tab to its right, else the left.
  Positional, not most-recent.
- Switching Folder: flush pending saves, close every Tab, open the new Folder.
  Close Folder does the same and sets `folder: null`. No per-Folder Tab memory.
- Out-of-Folder Documents get normal Tabs and Open Editors rows with the parent
  dimmed; they never appear in the Explorer.
- The tab bar, Open Editors, the successor rule and the `openEditors` array are
  **new Fuwa code**; Tolaria persists neither tabs nor open editors.

**Dirty state and prompts**: no dirty indicator anywhere. Closing a Tab never
prompts; it flushes then closes. **Write failure** is the only prompt in the
app: the Tab stays open with an error bar "Couldn't save to <path>" offering
**Retry** and **Discard changes**; closing that Tab offers the same two; quitting
flushes everything first and, if any flush fails, stays open with the same
dialog plus **Discard and quit**. The prompt can never appear for an Image Tab.

**Delete and rename of an open file**

1. Deleted from the Explorer: cancel any pending Autosave, close the Tab.
2. Renamed from the Explorer: the Tab follows the new path; no reload.
3. Deleted externally: close the Tab. Fuwa never recreates a removed file.
4. Renamed externally: Tolaria's watcher reports only changed paths, so port
   its same-name heuristic unchanged: if the open path vanished and exactly one
   changed path has the same file name, retarget; otherwise treat as (3). A
   same-name move is followed; a rename closes the Tab and the new name appears
   as a fresh file.
5. Folder-level rename or delete: path-prefix match, then apply the rules above
   per Tab. Out-of-Folder Documents have no sibling paths, so external rename
   always resolves as (3).

### 6. Design tokens and typography

Source: *Design tokens and editor typography*. Full reference:
`docs/research/linear-app-tokens.md` and
`prototypes/tokens/linear-app-values.html` on `prototype/shell-layout`.
`Linear_DESIGN.md` at the repo root describes the marketing site and is
historical; **the Linear app is the source of truth.**

1. **Theme modes**: light / dark / system through Tolaria's mechanism as-is
   (`data-theme` attribute **and** `.dark` class on the root, so shadcn `dark:`
   variants and the kernel CSS both work). Default on first launch: **dark**.
2. **Palettes**: both themes are the output of Linear's default theme-generator
   inputs (dark base LCH `5.52 0.4 272`, accent `47.92 59.30 288.42`,
   contrast 27; light base `97.94 0.5 282`, accent `53 52.26 286.91`,
   contrast 30). Sidebar uses the sidebar sub-theme, popovers/dialogs/tooltips
   the menu sub-theme, the editor the base theme. Dark: canvas and sidebar
   `#09090a`, content card `#111212` (radius 12px, shadow
   `0 0.5px 1px 1px rgba(0,0,0,.3)`), popover `#202022` with a 0.5px `#323336`
   border, title `#ffffff`, body `#e2e3e5`, muted `#949597`, faint `#565658`,
   border `#232325`. Light: sidebar `#eeeeef`, card `#f8f8f9`, popover
   `#ffffff`, title `#1b1b1b`, body `#2f2f31`, muted `#5b5c5e`, border
   `#dedede`.
3. **Accent**: indigo `#5e69d1` (hover `#6974e1`) for primary buttons, the
   focus ring (`0 0 0 1px`) and table selection. Editor links `#adbbff` dark /
   `#3f60d9` light, underline on hover only. **No acid lime anywhere**; the
   empty state's Open Folder button is indigo.
4. **Editor typography**: body 15px / 1.6 / weight 450 / letter-spacing
   −0.0067em, paragraph gap 16px; h1–h4 22/19/17/15 px with line heights
   29.6/28/24/24, all weight 600 in the title colour, top margins 48/32/24/22;
   strong 600; inline code 0.9375em on `rgba(255,255,255,.075)` with a hairline
   inset border, radius 0.2em; code block 13px / 1.4 on the canvas colour,
   hairline border, 6px radius; blockquote 4px rounded bar; hr 1px; tables
   hairline with 6px radius and a shaded header row; checkbox 14px / radius 3,
   checked fills with the body colour. Content column 680px centred (the one
   deliberate departure from Linear's wide documents).
5. **Fonts**: Inter Variable (weight 450 needs the variable font) and
   **JetBrains Mono** only; IBM Plex Mono is dropped. No global OpenType
   features; `calt` on headings, `tnum` where numbers align. Root font-size
   stays 14px for the kernel's rem calibration; Linear's sizes are written in
   px. Wherever this spec says "mono" it means JetBrains Mono.
6. **Hairlines**: a `--hairline` variable, 0.5px on HiDPI and 1px otherwise,
   used by Fuwa chrome and, when the editor theme is re-valued, by code block,
   table and inline-code borders. Inputs and checkboxes stay 1px.
7. **Interactive states** (dark; light from the generator): sidebar rows 28px,
   radius 8px, 13px/500, hover `#1d1e1f` with white text, active `#28292b`;
   icon buttons 28×28 round, hover `#232324`, open `#2c2d2e`; secondary button
   `#1b1b1c` hover `#242526`; menu items 32px, hover pill radius 8px ≈
   `#303133`, shortcuts 11px/500 in `#9c9d9f` set in Inter; tooltip on the menu
   surface, radius 8px, 11px; input `#111212` with 1px border and 8px radius;
   selection = muted at 20%; overlay `#00000066`.
8. **Tab bar**: Linear desktop's chrome-tab tokens: inactive transparent with
   `#949597` text, hover `#1e1f22`, active `#232427` with white text.
9. **Content chroma**: Linear's seven chromatic roles (teal, green, yellow,
   orange, red, blue, purple, each as base/text/bg) replace Tolaria's accent
   family; highlight marks and callout types map onto them, callouts drawn
   Linear-style (accent at 2% background, 20% border, hairline, 6px radius).
   Code highlighting: keyword `#e394dc`, string `#00c5f0`, title `#25f8ca`,
   attr `#fce27d`, literal `#ec3b40`, comment = faint. Raw-mode syntax
   variables and the shiki themes keep Tolaria's values.
10. **Mechanism**: Tolaria's app stylesheet and theme JSON are copied verbatim
    and re-valued in place; no variable renames. Contract mapping: app and
    sidebar surfaces → sidebar base background; editor, card and panel surfaces
    → base background; popover and dialog → menu background; input → input
    background; button → secondary control; heading text → label title;
    primary text → label base; secondary and tertiary → label muted; muted and
    faint → label faint; default and subtle borders → border; strong border →
    solid border; hover → base hover; selected → selected; focus ring → focus
    colour; accent blue → primary control. shadcn: `--primary` → primary
    control, `--popover` → menu background, `--accent` / `--muted` → base
    hover / shade, `--ring` → focus colour, `--radius: 8px` (so md = 6px).

### 7. Shortcuts, menus and the Rich/Raw toggle

Source: *Keyboard shortcuts and the Rich/Raw toggle*, inputs from *Empty
states* and *Design tokens*.

**Mechanism**: Tolaria's single manifest-driven shortcut registry carries over:
the shared command manifest is read by the Rust menu builder for native
accelerators and by the keyboard hook and command dispatcher for keydown
matching. Fuwa trims the manifest to the table below; nothing else defines an
app-level shortcut. Native menu bar with **Fuwa, File, Edit, View, Window**
(no Format, Go, Note, Vault or Help). The prevent-default plugin's reserved
lists: command keys `["O", "F"]` as in Tolaria; command-shift keys `[]`. New
chords (⌘[, ⌘⇧[, ⌘⇧], ⌘1–9) are added only if native QA shows WKWebView
swallowing them.

**App-level shortcuts**

| Key | Command | Menu |
|---|---|---|
| ⌘N | New Document | File |
| ⌘O | Open Folder… | File |
| ⌘⇧O | Open Document… | File |
| — | Close Folder | File |
| ⌘P | Quick Open (Command Menu, search-only mode) | File |
| ⌘S | Save now (forces the Autosave flush) | File |
| ⌘W | Close Tab; with zero Tabs, close the window (Dock reopen restores the Session) | File |
| ⌘Z / ⌘⇧Z | Undo / Redo | Edit |
| ⌘⇧V | Paste without Formatting | Edit |
| ⌘F | Find in the current Document (both modes) | Edit |
| ⌘K | Command Menu | View |
| ⌘[ | Toggle Sidebar | View |
| ⌘\ | Toggle Rich/Raw (Tolaria's binding, including its macOS alternate event) | View |
| — | Appearance ▸ System / Dark / Light | View |
| ⌘= / ⌘- / ⌘0 | Zoom In / Zoom Out / Actual Size | View |
| ⌘⇧[ / ⌘⇧] | Previous / Next Tab, positional | Window |
| ⌘1 … ⌘9 | Jump to Tab N | — |
| ⌘Q | Quit | Fuwa |

Dropped from Tolaria: ⌘, (no settings screen), ⌘1–3 view modes, ⌘←/→ history,
⌘E organize, ⌘D favorite, ⌘⌫ delete, ⌘⇧F/I/L/T/O. Rejected: ⌘E for Raw
(TipTap inline code), ⌘B / ⌘⇧B for the sidebar (bold), ⌘⇧E, Ctrl+Tab MRU
order, a bare `[`. ⌘[ shadows CodeMirror's indent-less in Raw mode; ⌘] stays.

**Menu enable state** (Tolaria's state groups): no Document → Save, Close Tab,
Toggle Rich/Raw, Find disabled; no Folder → New Document, Quick Open, Close
Folder disabled. ⌘O and drag-and-drop work in every state. The Command Menu
always opens; with no Folder it lists commands only.

**Editor-level shortcuts, carried unchanged**: Tolaria's ⌘T todo toggle, ⌘⇧M
highlight, ⌘⇧` code block, ⌘A inside a code block selects that block, Tab /
⇧Tab nest and un-nest lists, Tab in a code block inserts two spaces, arrow
keys by logical line in code blocks, block-selection keys (Esc, Enter, ⌘Enter
collapse, ⌘⇧↑/↓ move, Delete), Enter or F2 on rendered math, Escape blurs.
BlockNote/TipTap defaults: ⌘⌥0 paragraph, ⌘⌥1–6 headings, ⌘⌥Q quote, ⌘⇧6/7/8/9
toggle/numbered/bullet/check list, ⌘B/I/U, ⌘⇧S strike, ⌘E inline code, ⌘⇧↑/↓
move block, ⌘K link while text is selected (this wins over the Command Menu
when there is a non-empty selection in Rich mode). Raw mode: CodeMirror default
and history keymaps, ⌘S save, Tab inserts a tab. None appear in the menu bar.

**Command Menu**: ⌘K lists every manifest command; typing fuzzy-matches
commands, Document names and Image file names together (names only, never
contents). ⌘P opens the same component in Quick Open mode: files only, no
commands. **New Fuwa code** on the manifest; Tolaria's command palette and
command hooks are not ported.

**Rich/Raw toggle**: the `Rich | Raw` segmented control at the right end of the
path row, nothing in the tab bar. Hover tooltip in mono, e.g. `Raw ⌘\`.
Invalid Frontmatter disables the Rich segment with the tooltip "Fix the
frontmatter to use Rich mode". Secondary paths into Raw: the Frontmatter badge
and ⌘↵ in Quick Open.

### 8. Repo layout and build baseline

Source: *Repo layout and build baseline*, corrected by *Explorer
write-operation UX*; ADR-0001.

1. **Repo shape**: one import commit of the kept files from Tolaria at
   `ee768ac`, no history merge; Tolaria added as the `upstream` remote so
   `git diff upstream/main -- <path>` and `git cherry-pick` are native. Single
   package, no workspace.
2. **Layout**: Tolaria's `src/` directories verbatim and its Rust vault,
   watcher and asset-scope modules. Fuwa-authored shell code (app, sidebar,
   tab bar, palette, session, empty states, `take_pending_open`, `list_files`,
   the single-root boundary rewrite) lives in the **same** directories. Unit
   tests as sibling `*.test.ts(x)`; Playwright specs under `tests/smoke`.
3. **Vocabulary**: code says `note` and `vault`, including Fuwa-authored
   identifiers; UI copy and docs say Document and Folder.
4. **Toolchain**: Tolaria's version specifiers, resolved fresh (no lockfile
   carried). Exact pins on the six patched packages (`@blocknote/{core,react,
   code-block}` 0.46.2, `@tiptap/extension-{link,code}` 3.19.0,
   `prosemirror-tables` 1.8.5). Only the two `uuid` overrides carried.
   pnpm 10.33.2, node ≥ 22, rust 1.77.2, Vite ^7.3.5, Vitest ^4.1.10,
   TypeScript ~5.9.3, Tailwind ^4.1.18, React ^19.2, Tauri 2.11.5 /
   tauri-build 2.5.4 / CLI ^2.11.4. `@blocknote/mantine` and `@mantine/*` are
   dropped; `@blocknote/shadcn` added with its Tailwind `@source` line.
5. **Tauri crate features**: `protocol-asset`; `devtools` behind a dev-only
   cargo feature. `macos-private-api`, `image-png` and `withGlobalTauri`
   dropped.
6. **Rust command surface**: the 18 required commands (note content get /
   validate / save / create, delete and batch delete, filename rename, move to
   folder, folder create / rename / delete / list, save image, copy image to
   vault, watcher start / stop, open externally, reveal in file manager), plus
   Fuwa-owned `list_files` and `take_pending_open`, plus the asset-scope sync
   called once per Folder open, plus clipboard read and copy with Tolaria's
   clipboard module kept verbatim (the single optional-Rust exception: ⌘⇧V needs
   a native clipboard read on WKWebView). Delete goes to the macOS Trash via
   the `trash` crate. **No rename transaction module and no marker directory.**
   Plugins: dialog, opener, log, prevent-default.
7. **Tauri config**: product name Fuwa, identifier `com.aimerite.fuwa`, crate
   `fuwa` / lib `fuwa_lib`; bundle target `app` only; window 1200×800, min
   640×480, overlay title bar, hidden title, traffic-light inset chosen for the
   44px top row, background `#09090a`; `dragDropEnabled: true` with the image
   drop hook on the native drag-drop branch only; asset protocol with runtime
   scope; CSP keeps `style-src 'unsafe-inline'` (with the matching
   disable-modification entry) and `'wasm-unsafe-eval'`, drops PostHog,
   websocket, `https:` connect and the HTML-block scheme; file association as
   in section 3.
8. **Lint/format**: Tolaria's ESLint 9 flat config (js recommended,
   typescript-eslint, react-hooks with `refs` and `set-state-in-effect` as
   errors, react-refresh). No formatter, so files stay byte-comparable.
   rustfmt and clippy defaults. No git hooks.
9. **CI**: one GitHub Actions workflow on a macOS runner: `tsc`, ESLint,
   Vitest, `cargo clippy`, `cargo test`. No build artifact, no Playwright.
10. **Attribution**: root `NOTICE.md` (kernel copied from Tolaria at `ee768ac`,
    copyright Luca Rossi and contributors, AGPL-3.0-or-later, modified from
    2026-09 by Fuwa); `LICENSE` with the AGPL text; license fields in
    package.json and Cargo.toml. No per-file headers.
11. **Bundle-size record**: the baseline session writes `docs/build-baseline.md`
    with the `vite build` JS total, gzip total, the five largest chunks, and the
    release binary and `.app` sizes. No threshold.

### 9. Test plan

Source: *Repo layout and build baseline*, *Kernel port inventory*, *Charting*.
See [Testing Decisions](#testing-decisions) for the seams.

- **Vitest** (jsdom, Tolaria's setup trimmed of the day-picker and virtuoso
  mocks, `maxWorkers: 4`): the ~110 carried Tolaria test files (~22k LOC)
  plus the nine pnpm patch-guard regression tests, with wikilink and
  remote-image cases stripped. Three tests parse the editor CSS as text; CSS
  surgery keeps their selectors.
- **Rust**: Tolaria's inline `mod tests` in the vault file, image, trash,
  folders, filename-rules, path-identity, rename (filename and move cases) and
  watcher modules; new tests alongside the boundary rewrite.
- **Playwright smoke** (Chromium against `pnpm dev` with mock Tauri; the Tauri
  WebDriver has no macOS support): six specs, one worker, local-only, not in
  CI. The mock is an in-memory Folder fixture (~150–200 LOC) answering
  `list_files`, note content get and save, folder list, watcher start/stop and
  `take_pending_open`. Specs: boot to the empty state; open Folder shows the
  Explorer; open Document renders Rich; typing triggers an Autosave invoke;
  Rich/Raw round-trip; Quick Open finds a Document by name.
- **CI** runs type-check, lint, Vitest, clippy and cargo test on macOS. Smoke
  and the bundle build are run by hand.

### 10. Out of scope (from the map)

See [Out of Scope](#out-of-scope).

## Testing Decisions

**What makes a good test here**: it exercises external behaviour through a
boundary that will outlive the implementation. The carried Tolaria tests
already do this at their own seams (Markdown in, blocks out; a hook's observable
state; a CSS file's selectors); they are the reason a verbatim copy is safe and
they must stay green with the fewest edits.

**Seams** (proposed for the walk-through; existing seams preferred, one ideal):

1. **The Tauri command boundary** is the one new seam. Everything Fuwa authors
   (Session, tab bar, Open Editors, Explorer, Command Menu, empty states,
   file-association intake) talks to disk only through `invoke`. The mock-Tauri
   Folder fixture stands in for the Rust side, so the smoke specs drive the
   whole React app end to end without a native build. This is the highest seam
   available and the only one Fuwa adds.
2. **The Markdown serialization owner** (Markdown ↔ blocks) is Tolaria's
   existing seam and stays as is; the serialization tests are the most valuable
   carried group because they are pure TypeScript.
3. **Hook seams** (save, tab swap, watcher, rename, image drop, raw-mode sync)
   are Tolaria's and are carried with their tests; Fuwa's deviations (per-Tab
   mode, Trash delete, native drop) get cases added at the same seams.
4. **Rust unit seams** stay inline per module.

**Which modules are tested**: the serialization owner and durable blocks; mode
switch and caret mapping; tab swap and parse pipeline; save, images, watcher,
rename, folders; schema and renderers; extensions; the raw editor; theming;
the patch guards; Rust vault modules. Fuwa-authored: the Session reducer
(restore rules, successor rule, missing Folder and Document), the Explorer
tree (placement rule, collision suffixing, extension lock, sort), the Command
Menu matcher, and the six smoke specs.

**Prior art**: Tolaria's `*.test.ts(x)` files listed in the kernel port
inventory, section 7, grouped by seam; its inline Rust tests; its
`mock-tauri` module (superseded here by the Folder fixture).

## Out of Scope

Ruled beyond the destination on the map; returns only as a fresh effort.

- Wikilinks, backlinks, a frontmatter properties panel, note types: Tolaria
  vault semantics, not a Markdown editor's job.
- Full-text search. Quick Open matches Document and Image file names only,
  never contents.
- Git integration, AI features, telemetry or analytics, i18n (UI is English
  only).
- More than one Folder at a time, multiple windows, tab drag-reorder, VS
  Code-style preview tabs.
- A `fuwa file.md` CLI, Windows and Linux builds, code signing, notarization,
  auto-update.
- Spreadsheet blocks (IronCalc).
- A settings/preferences panel, including making Explorer behaviours
  (new-Document placement) configurable; v0.1 ships one fixed rule.
- Opening an Image file from outside Fuwa (file association and the window drop
  target accept `.md` only).
- Sandboxed-script HTML blocks and their custom protocol; remote-image paste;
  attachment rename sync; a deep-link protocol.

## Further Notes

### Reconciliations made while assembling

Later tickets win. Confirm these in the walk-through.

1. **⌘N with no Folder.** Charting said ⌘N would use a Save-As dialog, and the
   Explorer ticket repeated that under "unchanged". The Empty states and
   Shortcuts tickets, decided in between, disabled ⌘N without a Folder. The spec
   says **disabled**.
2. **Bundle identifier.** Charting and the Session ticket used `com.fuwa.app`;
   the repo baseline settled `com.aimerite.fuwa`. The spec uses
   `com.aimerite.fuwa`, so the Session file lives under that directory name.
3. **Default theme.** Charting said "follow the system by default"; the tokens
   ticket set first launch to **dark**. The spec says dark; `system` remains
   selectable.
4. **Traffic-light inset.** The repo baseline wrote (18, 24); the collapsed
   sidebar ticket then fixed a 44px top row with the lights centred in it. The
   spec says the inset is chosen for the 44px row and verified visually, and
   does not fix numbers.
5. **Mono font.** Earlier tickets say "Berkeley Mono" for tooltips and
   metadata; the tokens ticket ships JetBrains Mono only, and sets the Command
   Menu's shortcut column in Inter 11px/500. The spec uses JetBrains Mono
   wherever it says mono, and Inter for that one column.
6. **Explorer engine and rename transaction.** The port-depth item "FolderTree
   copy-and-trim" and the repo-baseline `.fuwa-rename-txn` marker were both
   withdrawn by the Explorer ticket; the spec carries the corrected form (tree
   rewritten, primitives copied; rename is one `fs::rename`).
7. **Quick Open scope.** Charting said Document names only; the Image ticket
   added Image file names. The glossary already reflects this.
8. **Shell prototype details** superseded by later tickets (the `fuwa ▾`
   header row, `⌘⇧E` hints, acid-lime Open Folder button, 38px top row) are not
   carried; the settled values are in sections 2 and 6.

### Deferred to implementation, with the rule fixed here

- **KaTeX chunking.** The repo baseline handed this ticket the call once a
  bundle number exists. No build exists yet, so the spec fixes the rule
  instead: KaTeX stays a static import in v0.1; the baseline session records
  the size in `docs/build-baseline.md`; splitting is a post-v0.1 change.
- **`Opened`-before-`Ready` ordering** is derived from tao and Apple docs, not
  observed. The first implementation session logs it and keeps the buffered
  intake regardless.
- **Reserved-key additions** for the prevent-default plugin happen only if
  native QA shows WKWebView swallowing ⌘[, ⌘⇧[, ⌘⇧] or ⌘1–9.
- **The expand/collapse transition** is not specified; only the two end states
  are.

### Suggested implementation order

Not decisions, only a reading of the blocking structure:

1. Repo baseline: import Tolaria at `ee768ac`, toolchain, stubs, config,
   attribution, CI green on the carried tests, `docs/build-baseline.md`.
2. Kernel wiring: rewritten editor shell, shadcn flavor, re-valued tokens,
   per-Tab mode, native drop intake.
3. Shell: Session, tab bar, Open Editors, path row, empty states, collapsed
   state, file-association intake.
4. Explorer: `list_files`, tree, creation, rename, Trash, drag-move, context
   menu, Image Tabs.
5. Command Menu and Quick Open; menu bar and manifest trim.
6. Smoke specs and the local `.app` build.

`/to-tickets` was run over this document on 2026-09-10; the resulting tickets
and their blocking edges are listed on
[Assemble the v0.1 spec](https://linear.app/aimerite/issue/AIM-371).
