---
status: accepted
date: 2026-09-10
amended: 2026-09-12 (review)
---

# A Document opened on its own uses its directory as the boundary root

Fuwa's Rust boundary confines every file command to one root that the caller names on each call; there is no registry or "active Folder" behind it, and a call without a root is refused.

A Document can be opened without a Folder, or from outside the open Folder (File → Open Document…, Finder, a drop). Such a Document has no Folder to name, but it must still be read and written through the same commands, and an image pasted into it must still land in an `attachments/` directory beside it (the glossary's definition of an Attachment).

## Decision

The boundary root of a Document outside the Folder is **its own parent directory**. The renderer derives it from the path (`noteRootForPath`) and passes it as `vaultPath` to `get_note_content` and `save_note_content`, and uses the same directory as the save hook's persistence scope and as the editor's `vaultPath`, the base that image links and Attachments resolve against.

The root has to satisfy two containment checks: the Document's own path must be under it, and so must the `attachments/` directory beside the Document. The parent directory is the smallest directory that satisfies both. The alternatives fail one or the other:

- **A "current Folder" registry on the Rust side** (the original alternative): reintroduces the registry the boundary was built to remove, and a Document outside every Folder still needs a root.
- **The user's home directory**: contains both, but is wider than the parent for no gain.
- **A directory of Fuwa's own** (a temporary root under the app's config directory): does not contain the Document, so the boundary would refuse the Document itself.
- **The Document's file as the root**: does not contain `attachments/`, so Attachments would need a second root and a Rust-side special case.

The Rust side is unchanged: the parent directory is an ordinary root, so the containment and symlink checks apply to it as to a Folder.

For comparison, a survey of how other editors treat a lone file found this: VS Code, Zed and MarkText derive no root from the parent at all and confine nothing; a sandboxed macOS app is granted the file alone; Typora loads the parent folder into its sidebar. Fuwa's position sits between the unconfined editors and the sandbox. Every surveyed editor that copies pasted images puts them beside the file, or in a subfolder beside it, with a relative link, which is what the Attachment rule does.

## Consequences

- `useSaveNote` and `useEditorSave` carry the root through to the command: the save hook sends the persistence-scope entry that contains the path as `vaultPath`, and omits it when no scope is configured (the carried tests' shape).
- When a Folder is open and contains the Document, the Folder is the root as before; the parent-directory rule applies only to Documents outside it. The Explorer and Session code keep that distinction when they choose the root per Tab.
- The same directory is also what the Document watcher subscribes to and what the image asset protocol is allowed to read from, and both are recursive: the watcher uses `RecursiveMode::Recursive` and the asset scope is granted with `allow_directory(root, true)` and never revoked. The cost is proportional to how wide the parent is: a Document in `~/Desktop` watches the whole Desktop, and a Document in `~` watches the whole home directory. The surveyed editors watch the lone file itself, not its parent. Accepted for v0.1; narrowing the watch to the file and revoking the asset scope when the Tab closes is a behaviour change and is left for later.
- A Document at a filesystem root (`/x.md`) is refused, deliberately. The only parent it could name is `/`, and a root of `/` confines nothing and would watch the whole disk. On macOS the system volume is read-only, so the file cannot exist in practice. `noteRootForPath('/x.md')` returns the path itself, which `VaultBoundary::from_request` rejects because it is not a directory.
