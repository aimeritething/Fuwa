# Fuwa

A small desktop app for viewing and editing Markdown files. Open a `.md` directly, or open a folder and browse it from the sidebar. The editing kernel is ported from Tolaria; the visual language follows Linear.

## Language

### Content

**Document**:
A single `.md` file opened in Fuwa. Fuwa reads and writes the file on disk; it never owns a copy that outlives the session.
_Avoid_: Note, page, file (when you mean the Markdown content)

**Folder**:
The one directory the sidebar is currently rooted at. Fuwa never writes configuration into a Folder; only Documents and their attachments live there.
_Avoid_: Vault, workspace, project, root

**Attachment**:
An image pasted or dropped into a Document, stored in an `attachments/` directory beside that Document.
_Avoid_: Asset, upload

**Frontmatter**:
The YAML block at the top of a Document. Preserved byte-for-byte across saves; visible and editable only in Raw mode.

### Editing

**Rich mode**:
The WYSIWYG editing surface (BlockNote). It is also how a Document is "viewed"; there is no separate read-only preview.
_Avoid_: Preview, WYSIWYG mode, rendered mode

**Raw mode**:
The plain-Markdown editing surface (CodeMirror). Shows the exact bytes that are on disk, including Frontmatter.
_Avoid_: Source mode, code mode, plain mode

**Autosave**:
Writing a Document's pending edits to disk after a short idle delay. Disk is written first; in-memory state updates only after the write succeeds.

### Shell

**Explorer**:
The sidebar section that shows the Folder as a tree of Documents, sub-folders, and image files.
_Avoid_: File tree, folder tree, sidebar (the Explorer is one section of the sidebar)

**Open Editors**:
The sidebar section listing every Document currently open, including Documents outside the Folder. Mirrors the tab bar.

**Tab**:
One entry in the tab bar above the editor; one Tab per open Document. Clicking a Document in the Explorer always opens a real Tab (there are no preview tabs).

**Quick Open**:
The Cmd+P palette that fuzzy-matches Document names within the Folder. Searches names only, never contents.
_Avoid_: Command palette, search

**Session**:
The state Fuwa restores on launch: the Folder, the Open Editors (each with its Rich or Raw mode), the active Document, theme, sidebar state, and window geometry. Stored in the app's own config directory, never in the Folder.
