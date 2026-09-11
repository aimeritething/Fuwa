---
status: accepted
date: 2026-09-10
---

# A Document opened on its own uses its directory as the boundary root

Fuwa's Rust boundary ([AIM-377](https://linear.app/aimerite/issue/AIM-377)) confines every file command to one root that the caller names on each call; there is no registry or "active vault" behind it, and a call without a root is refused. Tolaria never had that gap because its commands looked bare paths up in a vault registry.

A Document can be opened without a Folder, or from outside the open Folder (File → Open Document…, Finder, a drop). Such a Document has no Folder to name, but it must still be read and written through the same commands.

## Decision

The boundary root of a Document that no Folder contains is **its own parent directory**. The renderer derives it from the path (`noteRootForPath`) and passes it as `vaultPath` to `get_note_content` and `save_note_content`, and uses the same directory as the save hook's persistence scope and as the editor's `vaultPath` (the base that image links and attachments resolve against, which is where Tolaria puts an out-of-vault Document's `attachments/` anyway).

The Rust side is unchanged: the parent directory is an ordinary root, so the containment and symlink checks apply to it as to a Folder.

## Consequences

- `useSaveNote` and `useEditorSave` carry the root through to the command: the save hook sends the persistence-scope entry that contains the path as `vaultPath`, and omits it when no scope is configured (the carried tests' shape).
- When a Folder is open and contains the Document, the Folder is the root as before; the parent-directory rule applies only to Documents outside it. The Explorer and Session tickets keep that distinction when they choose the root per Tab.
- A Document at a filesystem root (`/x.md`) has no parent to name; the boundary refuses it, which is acceptable for v0.1.
- The carried rename hook (`useNoteRename.ts`) still reads `get_note_content` without a root. It was expected to wake for Explorer rename ([AIM-387](https://linear.app/aimerite/issue/AIM-387)); it did not. That hook is Tolaria's *title-based* rename — it derives a slug from the H1, rewrites wikilinks and reconciles frontmatter — and spec section 3 removes title-based rename and the wikilink rewriter outright. Explorer rename edits the stem the user types and is one `fs::rename`, so AIM-387 wires `useExplorerActions` over a new `rename_vault_file` command instead, passing the Folder as the root. `useNoteRename.ts` stays in the tree under ADR-0001's port-depth rule, dormant and covered only by its carried tests; nothing calls it, so the root it omits reaches no command. (Deleted with the other zero-reference frontend code in [AIM-405](https://linear.app/aimerite/issue/AIM-405).)
