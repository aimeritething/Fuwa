# How other desktop editors scope a Document opened on its own

Companion to the review of [ADR-0002](../adr/0002-a-document-opened-on-its-own-uses-its-directory-as-the-boundary-root.md).
Researched 2026-09-12 from primary sources
only: the apps' source code on GitHub (`main` or the last tagged release, as noted), their official
help sites and release notes, and Apple's developer documentation. Forum posts are cited only where
the author is flagged as Obsidian staff. Nothing here comes from third-party blog posts.

## What Fuwa does today

When a Document is opened with no Folder, or from outside the open Folder (File → Open Document…,
Finder, a drop), ADR-0002 makes the Document's **parent directory** the root. As of this commit that
one directory is used for four things:

1. **Boundary root.** `noteRootForPath` (`src/utils/noteEntry.ts`) strips the last path segment and
   the renderer passes the result as `vaultPath` to every Rust file command;
   `src-tauri/src/commands/vault/boundary.rs` canonicalizes it and refuses any path outside it.
2. **Watch root.** `useVaultWatcher` starts `start_vault_watcher` on that directory, and
   `src-tauri/src/vault_watcher.rs` watches it with `RecursiveMode::Recursive`.
3. **Asset-protocol scope.** `sync_vault_asset_scope` (`src-tauri/src/asset_scope.rs`) calls Tauri's
   `scope.allow_directory(root, true)` (recursive) for that directory and never revokes it.
4. **Attachment location.** A pasted or dropped image lands in `attachments/` beside the Document
   and the Markdown gets a path relative to the Document (`src/components/Editor.tsx`,
   `src/utils/vaultAttachments.ts`).

Fuwa is not App-Sandboxed (`src-tauri/` has no entitlements file), so (1) and (3) are the app's own
policy, not something macOS imposes. A Document at a filesystem root (`/x.md`) is refused, which
ADR-0002 accepts for v0.1.

## Comparison

"Scope" is the directory (if any) the app treats as the root for a window that holds only a lone
file. "Watch" is what the app subscribes to for external changes in that situation.

| App | 1. Lone file, and the scope for that window | 2. What is watched | 3. Filesystem access granted / confined | 4. Pasted or dropped images and the path written | 5. `/x.md`, `~`, wide parents |
| --- | --- | --- | --- | --- | --- |
| **VS Code** (not sandboxed) | Yes. An "empty window" (`WorkbenchState.EMPTY`); no folder is derived from the file's parent. | **The file only, non-recursively**, and only while its editor is visible (`editorService.ts` → `fileService.watch(resource)` with the default `{ recursive: false }`). Workspace folders, when there are any, are watched recursively. | None in the file service; any URI readable. Workspace Trust is the only scope-ish concept; an empty window is trusted by default (`security.workspace.trust.emptyWindow`). The Markdown preview's webview may load local resources only from the **document's parent directory** when the file is not in a workspace (`getMarkdownLocalResourceRoots`). | Copied **next to the Markdown file** by default (`markdown.copyFiles.destination` is empty by default; fallback `Utils.dirname(docUri)`), link **relative to the document** (`getRelativeMdPath`). Untitled files never get a copy. | No refusal or warning for `/` or `~` in core. Because lone files are watched non-recursively the question does not arise for watching. Workspace Trust hides the "trust parent folder" checkbox when the folder is a filesystem root. |
| **Zed** (not sandboxed) | Yes. A **single-file worktree**: the worktree's `abs_path` *is* the file, its only entry is the root entry at the empty relative path (`Worktree::local`, `is_single_file`). If an existing worktree contains the path, the file opens inside it instead (`find_or_create_worktree`). | **The file path itself** (`fs.watch(&abs_path)`), not its parent. On macOS the FSEvents stream is registered recursively but rooted at the file. Rename/delete of the root is detected through an **open file handle** (`root_file_handle`, `report_root_moved_or_deleted`), not a parent watch. | None; no `com.apple.security.app-sandbox` in `zed.entitlements`; a path outside every worktree just becomes a new (invisible) worktree. | Clipboard image paste in Markdown (merged 2026-07) writes `image.png` / `image_N.png` **beside the file** inside its worktree and inserts `![](image.png)`. In a single-file worktree the file's relative path has no parent, so by code reading the paste falls through to plain text paste, i.e. **does not work**. Preview resolves relative image paths against the file's on-disk directory. | No special-casing of `/` found. `$HOME` is skipped only in git-ancestor discovery ("expensive and likely unwanted"). |
| **Obsidian** (closed; direct `.dmg`, no App Store build) | **No.** The unit of work is the vault (a folder, including subfolders); staff confirm loose-file "Open With" is not handled. `obsidian://open?path=` searches for "the most specific vault which contains the specified file path". | The whole vault folder, recursively ("Obsidian automatically refreshes your vault to keep up with any external changes"). | Confined to the vault by design ("requires access to the entire vault"). Local embeds must be inside the vault; a symlink is the documented workaround. Sandbox status undocumented. | Setting "Default location for new attachments": vault root (default), a fixed folder, **same folder as current file**, or **a subfolder under the current folder**. Link format: shortest / relative to file / absolute in vault. | No warning about `/` or `~` as a vault found; the only location warning is against vaults inside vaults. |
| **Typora** (closed; not on the App Store; no sandbox evidence) | Yes, and **the parent folder is loaded automatically**: "when you open a file, its parent folder will be automatically loaded" into the Files sidebar (file tree rooted there). | "Typora will watch for file changes in the opened folder" (the tree). The open file is auto-reloaded (release-note evidence only); recursion depth undocumented. | No sandbox evidence (uninstall paths are `~/Library/Application Support/abnerworks.Typora/`, not a container); no confinement documented. | Default: keep the image's own path. Optional: copy to `./${filename}.assets`, a custom absolute or `./`-relative folder, or upload; per-document `typora-copy-images-to` / `typora-root-url` front matter. "Use relative path if possible" writes a path **relative to the document, only once the file has been saved**. | None found. |
| **iA Writer** (closed; App-Sandboxed, App Store / Setapp) | Library "Locations" are user-added folders; opening a file outside them is not documented. | Undocumented (release notes: "Improved external file change handling"). | Sandboxed: "When using local images, they must be in a folder added as a Library location. This gives iA Writer permission to use the file." Content Blocks must be in the same folder or a subfolder of the master file (`../` allowed since 5.3). | "dragging a file onto the Editor adds a copy in the Library"; exact destination folder and clipboard paste undocumented. Path display: shortest / relative / absolute-in-Library. | None found. |
| **MarkText** (Electron, v0.17.1, not sandboxed) | Yes. A file opens with `rootDirectory = null`; no sidebar tree and no directory root (`_openedRootDirectory` stays empty). | **The file only**: `chokidar.watch(filePath, { depth: isOsx ? 1 : 0, ignoreInitial: true, usePolling: true on macOS })`. Folders, when opened, are watched recursively (`depth: undefined`). | None; `electron-builder.yml` `mac:` has no entitlements; Node `fs` used directly. | Default `imageInsertAction: "path"` (keep original location); pasted binaries go to a **global folder under the app's user-data dir**; only with "Prefer relative assets folder" **and** a saved file are they moved to `assets/` beside the file with a relative link. | None found. |
| **macOS App Sandbox** (Apple's rules for sandboxed apps) | Open panel, Finder "Open With", drag-in and Open Recent extend the sandbox to **the selected item**. A selected **file** grants "the specified file, and that file alone"; a selected **folder** grants "items within that folder, and recursively in nested folders". | Undocumented. FSEvents needs a directory hierarchy; Apple says nothing about FSEvents on a user-selected file or its parent under the sandbox. | Access to siblings needs one of: the user picking the folder; a **security-scoped bookmark** (app-scoped, for a file or folder; document-scoped, file only); or **Related Items** (`NSIsRelatedItemType` + `NSFilePresenter.primaryPresentedItemURL`): same base name, different declared extension, same directory. Nothing covers an arbitrary sibling or an `attachments/` subfolder. | Not covered by the grant: a sandboxed app cannot write `attachments/` beside a user-opened file without a separate folder grant. | Not applicable; the grant is the item, so there is no "wide parent" case. For non-sandboxed apps, TCC prompts once for Desktop/Documents/Downloads and then grants the folder's contents; user-selected files are exempt. |

## Per-app notes and sources

### VS Code

- **Empty window.** `WorkbenchState.EMPTY` is documented as "if the workbench was opened with empty
  window or file" in
  [`src/vs/platform/workspace/common/workspace.ts`](https://github.com/microsoft/vscode/blob/main/src/vs/platform/workspace/common/workspace.ts).
  The [workspaces docs](https://code.visualstudio.com/docs/editing/workspaces/workspaces) say: "It is
  also possible to open VS Code without a workspace. For example, when you open a new VS Code window
  by selecting a file from your platform's File menu, you will not be inside a workspace."
- **Watching.** `FileService.watch(resource, options = { recursive: false, excludes: [] })` in
  [`src/vs/platform/files/common/fileService.ts`](https://github.com/microsoft/vscode/blob/main/src/vs/platform/files/common/fileService.ts).
  The out-of-workspace call site is `EditorService.handleVisibleEditorsChange` in
  [`src/vs/workbench/services/editor/browser/editorService.ts`](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/services/editor/browser/editorService.ts):
  every visible editor whose resource is `!this.contextService.isInsideWorkspace(resource)` gets
  `this.fileService.watch(resource)` (no options, so non-recursive), disposed when the editor is no
  longer visible. Workspace folders are watched with `{ recursive: true, excludes }` in
  [`src/vs/workbench/contrib/files/browser/workspaceWatcher.ts`](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/files/browser/workspaceWatcher.ts).
  The `files.watcherInclude` description in
  [`files.contribution.ts`](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/files/browser/files.contribution.ts)
  states "By default, all workspace folders will be watched recursively".
- **Confinement.** `fileService.ts` has no reference to the workspace or trust. Workspace Trust for
  the empty window: `calculateWorkspaceTrust()` in
  [`src/vs/workbench/services/workspaces/common/workspaceTrust.ts`](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/services/workspaces/common/workspaceTrust.ts)
  and the settings `security.workspace.trust.emptyWindow` (default `true`) and
  `security.workspace.trust.untrustedFiles` (default `prompt`) in
  [`workspace.contribution.ts`](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/workspace/browser/workspace.contribution.ts);
  docs at [Workspace Trust](https://code.visualstudio.com/docs/editing/workspaces/workspace-trust).
- **Markdown preview resource roots.** `getMarkdownLocalResourceRoots` in
  [`extensions/markdown-language-features/src/util/resources.ts`](https://github.com/microsoft/vscode/blob/main/extensions/markdown-language-features/src/util/resources.ts):
  if the document is in a workspace, all workspace folders; else `Utils.dirname(resource)`. This is
  the closest analogue to Fuwa's asset-protocol scope: for a lone file, the parent directory and
  nothing else. `markdownEditorProvider.ts` additionally drops the parent directory when the window is
  in Restricted Mode.
- **Copy files.** `getDesiredNewFilePath` in
  [`copyFiles/newFilePathGenerator.ts`](https://github.com/microsoft/vscode/blob/main/extensions/markdown-language-features/src/languageFeatures/copyFiles/newFilePathGenerator.ts):
  "Default to next to current file" → `vscode.Uri.joinPath(Utils.dirname(docUri), file.name)`;
  name collisions get `-1`, `-2`, … . In
  [`copyFiles.ts`](https://github.com/microsoft/vscode/blob/main/extensions/markdown-language-features/src/languageFeatures/copyFiles/copyFiles.ts)
  a destination starting with `/` resolves against `${documentWorkspaceFolder}`, which "is the same
  as `${documentDirName}` if the file is not part of a workspace".
  [`dropOrPasteResource.ts`](https://github.com/microsoft/vscode/blob/main/extensions/markdown-language-features/src/languageFeatures/copyFiles/dropOrPasteResource.ts)
  skips copying for `untitled` documents. Release notes:
  [1.79](https://code.visualstudio.com/updates/v1_79) ("If the file currently isn't part of the
  workspace, VS Code will automatically copy the file into your workspace and insert a link to it").
- **Root / home.** No warning found in core. `parcelWatcher.ts` predefines one macOS exclude,
  `~/Library/Containers` ("Triggers access dialog from macOS 14"). `canSetParentFolderTrust()` in
  `workspaceTrust.ts` returns false when the folder equals its parent (a filesystem root). The Git
  extension has `git.openRepositoryInParentFolders` for the loose-file-in-a-home-repo case.

### Zed

- **Single-file worktree.** [`docs/src/worktree-trust.md`](https://github.com/zed-industries/zed/blob/main/docs/src/worktree-trust.md):
  "A worktree in Zed is either a directory or a single file that Zed opens as a standalone
  'project'." `Worktree::local`, `is_single_file` (`root_dir().is_none()`), `root_entry`, `root_file`
  in [`crates/worktree/src/worktree.rs`](https://github.com/zed-industries/zed/blob/main/crates/worktree/src/worktree.rs).
  `find_worktree` / `find_or_create_worktree` in
  [`crates/project/src/worktree_store.rs`](https://github.com/zed-industries/zed/blob/main/crates/project/src/worktree_store.rs):
  a path inside an existing worktree opens there; otherwise a new worktree rooted at the path is
  created (`visible` decides only panel visibility, git discovery, strong vs weak retention).
- **Watching.** `LocalWorktree::start_background_scanner` calls `fs.watch(&abs_path, FS_WATCH_LATENCY)`
  on the worktree root, which for a single-file worktree is the file.
  [`crates/fs/src/fs_watcher.rs`](https://github.com/zed-industries/zed/blob/main/crates/fs/src/fs_watcher.rs)
  adds only the path itself (plus a symlink target's parent); recursion is per-OS
  (`is_recursive`: poll watchers, macOS and Windows "cover their whole subtree"). Root rename/delete
  is handled through the open `root_file_handle` in `report_root_moved_or_deleted`; a vanished
  single-file root emits `ScanState::RootDeleted` and closes the worktree.
- **Confinement.** [`crates/zed/resources/zed.entitlements`](https://github.com/zed-industries/zed/blob/main/crates/zed/resources/zed.entitlements)
  has `files.user-selected.read-write` and `files.downloads.read-write` but no
  `com.apple.security.app-sandbox`. No worktree containment check exists on the `Fs` trait.
- **Images.** PR [#58588](https://github.com/zed-industries/zed/pull/58588) "editor: Add support for
  pasting images in Markdown" (merged 2026-07-13, closes
  [#18112](https://github.com/zed-industries/zed/issues/18112)). `Editor::paste_item`,
  `unused_image_path`, `insert_image_snippet` in
  [`crates/editor/src/clipboard.rs`](https://github.com/zed-industries/zed/blob/main/crates/editor/src/clipboard.rs):
  `dir_rel_path = file.path().parent()?`, then `worktree.create_entry(file_path, false, Some(bytes))`
  and the snippet `![$1]({filename})$0`. `RelPath::parent` in
  [`crates/path/src/rel_path.rs`](https://github.com/zed-industries/zed/blob/main/crates/path/src/rel_path.rs)
  returns `None` for the empty path, which is the single-file worktree's root entry; hence the
  single-file conclusion above (by code reading, not run). Preview resolution:
  `resolve_preview_image` / `get_folder_for_active_editor` in
  [`crates/markdown_preview/src/markdown_preview_view.rs`](https://github.com/zed-industries/zed/blob/main/crates/markdown_preview/src/markdown_preview_view.rs).
  [`docs/src/languages/markdown.md`](https://github.com/zed-industries/zed/blob/main/docs/src/languages/markdown.md)
  does not mention image paste.
- **Root / home.** `discover_ancestor_git_repo` in `worktree.rs`: "Unless $HOME is itself the worktree
  root, don't consider it as a containing git repository---expensive and likely unwanted." Nothing
  for `/`. CLI: [`crates/zed/src/zed/open_listener.rs`](https://github.com/zed-industries/zed/blob/main/crates/zed/src/zed/open_listener.rs)
  distinguishes files from directories only for window-reuse and `--wait`.

### Obsidian

Help pages are published from [`obsidianmd/obsidian-help`](https://github.com/obsidianmd/obsidian-help)
(`help.obsidian.md/*` now redirects to `obsidian.md/help/*`).

- **Vault only.** [Manage vaults](https://obsidian.md/help/manage-vaults): "A vault is a folder on
  your file system which contains your notes, attachments, and the configuration folder".
  [How Obsidian stores data](https://obsidian.md/help/data-storage): "A vault is a folder on your
  local file system, including any subfolders." [Obsidian URI](https://obsidian.md/help/uri):
  `path` "will cause the app to search for the most specific vault which contains the specified file
  path." Staff (WhiteNoise, Discourse `staff: true`) on the long-open feature request
  [#314](https://forum.obsidian.md/t/have-obsidian-be-the-handler-of-md-files-add-ability-to-use-obsidian-as-a-markdown-editor-on-files-outside-vault-file-association/314/81)
  (2022-10-21): "The unit of work of Obsidian is not a markdown file but a vault. … We could go the
  route that tangent notes, or vscode, took of implicitly creating a whole vault in the directory of
  the file that is being opened, but I am not sure that's something all users want when they just
  need to edit a file. Another complication is the need to recursively scan the directories backwards
  to find if the file belongs to vault whose root directory is above the file being opened." Earlier
  (2020-11-29, [#9211](https://forum.obsidian.md/t/opening-md-file-with-obsidian-instead-opens-most-recent-file/9211)):
  "we don't support obdisian being the default app for markdown files."
- **Watching.** Data-storage page: "Obsidian automatically refreshes your vault to keep up with any
  external changes." [Sync](https://obsidian.md/help/sync-notes) FAQ: "Obsidian requires access to
  the entire vault for its features". [Symlinks](https://obsidian.md/help/symlinks): file symlinks
  are not watched.
- **Attachments.** [Attachments](https://obsidian.md/help/attachments) and the "Files and links"
  section of [Settings](https://obsidian.md/help/settings): "Default location for new attachments"
  = Vault folder / In the folder specified below / Same folder as current file / In subfolder under
  current folder; "New link format" = Shortest path when possible / Relative path to file / Absolute
  path in vault. [Embed files](https://obsidian.md/help/embeds): "To embed a file in your vault";
  the only out-of-vault embed documented is a remote URL.
- **Install.** [Download and install](https://obsidian.md/help/install) lists a single macOS
  "Universal" `.dmg`; no App Store build; no sandbox statement.

### Typora

- **Parent folder loaded automatically.** [File Management](https://support.typora.io/File-Management/):
  "Although you do not need to open the folder explicitly in this way, when you open a file, its
  parent folder will be automatically loaded. You can check the folder from the 'Files Sidebar'".
  Same in [Quick Start](https://support.typora.io/Quick-Start/). "As a file based Markdown editor,
  Typora does not have concepts like 'default working folder'". macOS: Cmd-click on the title bar
  opens parent folders ([Typora on macOS](https://support.typora.io/Typora-on-macOS/)).
- **Watching.** File Management, "Refresh File List / Tree": "Typora will watch for file changes in
  the opened folder, and the file tree / list will be updated automatically when changes happen, such
  as a file being moved or deleted." Content auto-reload appears only in release notes
  ([0.9.73](https://support.typora.io/What's-New-0.9.73/): "Fix file auto reload not working on
  Windows / Linux"; [1.3](https://support.typora.io/What's-New-1.3/): renaming outside Typora on
  macOS also triggers the `${filename}.assets` rename).
- **Sandbox.** No official statement. [Trouble Shooting](https://support.typora.io/Trouble-Shooting/)
  lists `~/Library/Application Support/abnerworks.Typora/` and
  `~/Library/Preferences/abnerworks.Typora.plist`, not a `~/Library/Containers/` path. Distribution
  is direct download only.
- **Images.** [Images](https://support.typora.io/Images/): "By default, when you insert or drag and
  drop an image file into Typora, we will use the path of the image file for the attribute src."
  Copy-to-folder needs the file saved first ("1. Save your file into a given folder. 2. Enable Editor
  → Image Insert → Allow copy images to given folder…"); `typora-copy-images-to` and
  `typora-root-url` in front matter ([YAML](https://support.typora.io/YAML/)). "If you enable Editor
  → Image Insert → Use relative path if possible … and your work has been saved into a file, then when
  you drag and drop a local image, the src attribute will be set as a relative path to the current
  file (folder)." Custom folder syntax ([0.9.58](https://support.typora.io/What's-New-0.9.58/)):
  "either an absolute path, or a relative path to the folder of the current file … `${filename}` will
  be replaced with the filename of current file."

### iA Writer

- **Library Locations.** [Organize](https://ia.net/writer/support/library/organize): "In Locations,
  you have the ability to add folders and cloud storage to iA Writer. … you can add additional folders
  and use them as alternatives." [Trouble shooting](https://ia.net/writer/support/help/trouble-shooting):
  "Any folders added as locations to the Library must be indexed, which is CPU intensive. As such, we
  discourage adding extremely large folders such as entire system partitions." Container paths
  (`~/Library/Containers/pro.writer.mac/…`) on the same page show the app is sandboxed.
- **Permission via Library.** [Markdown Guide → Images](https://ia.net/writer/support/basics/markdown-guide):
  "When using local images, they must be in a folder added as a Library location. This gives iA
  Writer permission to use the file. … the leading slash must be omitted because it refers to the
  root directory of a device." [Content Blocks](https://ia.net/writer/support/library/content-blocks):
  "dragging a file onto the Editor adds a copy in the Library"; 4.0 release note: "Embedding only
  works for files in the same folder (or subfolders) as the master file"; 5.3: "`../Note.txt` will
  include a file from the parent folder" ([Version history](https://ia.net/writer/support/help/version-history)).
- **Watching.** Release notes only: 3.1.3 "Fixed an issue where documents did not refresh when changed
  by some text editors and third-party sync services"; 4.0 "Improved external file change handling".

### MarkText

All from tag [`v0.17.1`](https://github.com/marktext/marktext/tree/v0.17.1) (the last release).

- **File vs directory.** `normalizeMarkdownPath` in
  [`src/main/filesystem/markdown.js`](https://github.com/marktext/marktext/blob/v0.17.1/src/main/filesystem/markdown.js)
  returns `{ isDir, path }`; `_openPathList` in
  [`src/main/app/index.js`](https://github.com/marktext/marktext/blob/v0.17.1/src/main/app/index.js)
  sends files to `_createEditorWindow(null, fileList)` and directories to
  `_createEditorWindow(rootDirectory, fileList)`; `createWindow` in
  [`src/main/windows/editor.js`](https://github.com/marktext/marktext/blob/v0.17.1/src/main/windows/editor.js)
  calls `openFolder` only `if (rootDirectory)`. `app.on('open-file', …)` handles Finder opens.
- **Watching.** `Watcher.watch(win, watchPath, type)` in
  [`src/main/filesystem/watcher.js`](https://github.com/marktext/marktext/blob/v0.17.1/src/main/filesystem/watcher.js):
  `chokidar.watch(watchPath, { ignoreInitial: type === 'file', depth: type === 'file' ? (isOsx ? 1 : 0) : undefined, usePolling: isOsx ? true : pref, awaitWriteFinish: … })`
  with the comment "Just to be sure when a file is replaced with a directory don't watch
  recursively." `_doOpenTab` emits `watcher-watch-file` per tab; `openFolder` emits
  `watcher-watch-directory`.
- **No sandbox.** [`electron-builder.yml`](https://github.com/marktext/marktext/blob/v0.17.1/electron-builder.yml)
  `mac:` has `artifactName`, `icon`, `darkModeSupport`, `target` only.
- **Images.** [`src/main/preferences/schema.json`](https://github.com/marktext/marktext/blob/v0.17.1/src/main/preferences/schema.json):
  `imageInsertAction` enum `upload | folder | path`, default `path`; `imagePreferRelativeDirectory`
  default `false`; `imageRelativeDirectoryName` default `assets`. Global folder default
  `path.join(userDataPath, 'images')` in
  [`src/main/dataCenter/index.js`](https://github.com/marktext/marktext/blob/v0.17.1/src/main/dataCenter/index.js).
  `imageAction` in
  [`src/renderer/components/editorWithTabs/editor.vue`](https://github.com/marktext/marktext/blob/v0.17.1/src/renderer/components/editorWithTabs/editor.vue):
  `relativeBasePath = isTabSavedOnDisk ? path.dirname(pathname) : null`, replaced by the project
  root only when a folder is open and contains the file; `moveToRelativeFolder` in
  [`src/renderer/util/fileSystem.js`](https://github.com/marktext/marktext/blob/v0.17.1/src/renderer/util/fileSystem.js)
  returns `path.relative(path.dirname(filePath), dstPath)`.
  [`docs/IMAGES.md`](https://github.com/marktext/marktext/blob/v0.17.1/docs/IMAGES.md): "all images
  are copied relative to the opened file. The root directory is used when a project is opened … The
  local resource directory is used if the file is not saved."

### macOS App Sandbox

Apple's developer site is a JavaScript app; quotes were read from its documentation JSON. The old App
Sandbox Design Guide now redirects, so its text is quoted from the Internet Archive copy.

- **Item-scoped grant.** [Accessing files from the macOS App Sandbox](https://developer.apple.com/documentation/security/accessing-files-from-the-macos-app-sandbox):
  "The operating system displays open and save panels in a separate process, and extends your app's
  sandbox to include the selected URLs." "When the URL your app receives from a standard user
  interface interaction represents a folder, the operating system extends your app's sandbox to
  items within that folder, and recursively in nested folders." Design Guide, "Powerbox and File
  System Access Outside of Your Container": "If a user instead opens a specific file, or saves to a
  new file, the system makes the specified file, and that file alone, available to your app." Also:
  "By default, files opened or saved by the user remain within your sandbox until your app
  terminates". Entitlement page
  [`com.apple.security.files.user-selected.read-write`](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.files.user-selected.read-write)
  says only "read-write access to files the user has selected using an Open or Save dialog".
  Finder/drag implicit consent is stated on the TCC pages, e.g.
  [`NSDocumentsFolderUsageDescription`](https://developer.apple.com/documentation/bundleresources/information-property-list/nsdocumentsfolderusagedescription):
  "The user implicitly grants your app access to a file … when selecting the file in an Open or Save
  panel, dragging it onto your app, or opening it in Finder."
- **Security-scoped bookmarks.** Same article, "Persist file access with security-scoped URL
  bookmarks": create with `withSecurityScope`, resolve, then
  `startAccessingSecurityScopedResource()`. [`bookmarkData(options:…)`](https://developer.apple.com/documentation/foundation/nsurl/bookmarkdata(options:includingresourcevaluesforkeys:relativeto:)):
  app-scoped bookmarks are tied to the code-signing identity; document-scoped ones travel with the
  document. Design Guide: "A document-scoped bookmark can point only to a file, not a folder"; an
  app-scoped bookmark gives "persistent access to a user-specified file or folder". Entitlements
  `com.apple.security.files.bookmarks.app-scope` / `document-scope`
  ([Entitlement Key Reference](https://developer.apple.com/library/archive/documentation/Miscellaneous/Reference/EntitlementKeyReference/Chapters/EnablingAppSandbox.html)).
- **Related Items.** Design Guide, "Related Items": "lets your app access files that have the same
  name as a user-chosen file, but a different extension" via `NSIsRelatedItemType` on the document
  type and an `NSFilePresenter` whose `primaryPresentedItemURL` is the main file.
  [`primaryPresentedItemURL`](https://developer.apple.com/documentation/foundation/nsfilepresenter/primarypresenteditemurl):
  "an NSOpenPanel object will grant access only to the user-selected movie file (the primary item)
  and not its associated subtitle file (the secondary item)." The modern article's "Use related file
  access to work with groups of files" repeats the mechanism. Apple states only the positive rule;
  that it excludes other siblings and subfolders is the contrapositive, not a quoted sentence.
- **TCC for non-sandboxed apps.** The `NS{Desktop,Documents,Downloads}FolderUsageDescription` pages:
  a first unconsented access prompts for "the folder's contents"; user-selected files are exempt and
  "Your app can access that file right away and any time in the future." "App Sandbox enforces
  stricter limits … so that policy may supersede this one if your app enables sandboxing."
- **Watching under the sandbox.** [File System Events](https://developer.apple.com/documentation/coreservices/file_system_events)
  and [`NSFilePresenter`](https://developer.apple.com/documentation/foundation/nsfilepresenter) say
  nothing about sandbox scope; `NSFilePresenter` only reports changes made through a file
  coordinator. Whether FSEvents on a selected file's parent delivers events inside the sandbox is
  undocumented.

## What this means for ADR-0002

Taking the four uses of the parent directory in turn, against what the surveyed apps do for a lone
file:

**"Parent directory as root" as the *sidebar / scope* concept is done by exactly one surveyed app,
Typora.** Typora loads the parent folder into its file tree automatically when a file is opened. VS
Code (empty window), Zed (single-file worktree) and MarkText (`rootDirectory = null`) all model a lone
file as a window or worktree with **no directory root at all**; the file is the unit. Obsidian goes
the other way and has no lone-file mode: the vault is the unit, and its staff named "implicitly
creating a whole vault in the directory of the file" as a route they chose not to take, citing users
who "just need to edit a file" and the cost of scanning parents. iA Writer's documented model is a
user-curated Library of folders; a lone file outside it is not documented.

**Watching the parent directory recursively is the widest choice in the set.** Every surveyed
open-source editor that opens lone files watches **the file only**: VS Code (`fileService.watch(resource)`
non-recursive, and only while visible), Zed (`fs.watch` on the file path plus an open handle for
rename/delete), MarkText (chokidar on the file path with `depth` 0 or 1). Recursive watching in those
apps is reserved for an explicitly opened folder or workspace. Typora documents watching "the opened
folder" because its sidebar shows that folder; depth is undocumented. Obsidian watches the whole vault
because the vault is what the user opened. Fuwa's recursive watch on the parent is therefore closer to
Typora and Obsidian's *folder* behaviour than to any app's *lone file* behaviour, and it is applied to
a directory the user did not choose. The concrete cost is proportional to the parent: a Document in
`~/Downloads` or `~` puts an FSEvents stream on everything beneath it.

**Confining file commands to the parent directory is narrower than any non-sandboxed peer and wider
than the sandbox.** VS Code, Zed and MarkText have no path confinement at all; opening a file outside
the workspace/worktree either just works or creates a new worktree. Apple's sandbox, at the other end,
grants **the file alone**; siblings need a folder grant, a bookmark, or the same-name/different-extension
Related Items rule, and no mechanism covers an `attachments/` subfolder. Fuwa sits between: the
boundary refuses paths outside the parent (narrower than VS Code/Zed), but grants the whole parent
tree (wider than what a sandboxed app would receive). Since Fuwa is not sandboxed, this is a policy
choice, not an OS constraint; its practical purpose is the containment and symlink checks ADR-0002
mentions, which any root would provide.

**Whitelisting the parent directory for image loading has a direct precedent.** VS Code's Markdown
preview does the same thing for a file with no workspace: `localResourceRoots` becomes the document's
parent directory (`Utils.dirname(resource)`), recursively, and nothing else. Zed's preview resolves
relative paths against the file's on-disk directory. Fuwa's asset-protocol scope is the same shape.
Two differences: VS Code's roots are per-webview and die with it, while Fuwa's `allow_directory`
grants are process-global and never revoked; and VS Code drops the parent in Restricted Mode.

**Putting Attachments beside the Document with a relative link is the common practice.** VS Code
(default "next to current file", relative link), Zed (`image.png` beside the file, `![](image.png)`),
Typora ("relative path to the current file" once saved), Obsidian ("Same folder as current file" /
"In subfolder under current folder" options), iA Writer (copy into the Library, relative or shortest
path) and MarkText (`assets/` beside the file when the relative option is on) all write into the
Document's directory or a subfolder of it and link relatively. A subfolder specifically (`attachments/`)
matches Obsidian's subfolder option, Typora's `${filename}.assets`, and MarkText's `assets/`; VS Code
and Zed default to the same directory with no subfolder. Two caveats the peers handle and Fuwa should
be aware of: several apps refuse to copy for an unsaved/untitled file (VS Code, Typora, MarkText), and
Zed's paste silently does nothing in a single-file worktree because the root entry has no parent.

**Filesystem root and home directory.** No surveyed app refuses a file at `/` or warns about a lone
file in `~`. For VS Code, Zed and MarkText the question does not arise because nothing is derived from
the parent. Zed's only home-directory special case is to stop git-ancestor discovery at `$HOME`
("expensive and likely unwanted"); iA Writer discourages adding "extremely large folders such as
entire system partitions" to the Library. Fuwa's refusal of `/x.md` is a consequence of deriving a
root from the parent, and its exposure to a wide `~` is the same consequence applied to watching and
asset scope.

In summary: **wider than common practice** for watching and for the asset-scope lifetime (no peer
watches an unchosen parent recursively; VS Code scopes the parent per-webview); **in line with common
practice** for Attachment placement and the relative link, and for treating the parent as the image
base; **an outlier with one precedent (Typora)** for treating the parent as a scope concept at all;
**a middle position with no direct peer** for the boundary: peers either confine nothing (VS Code, Zed,
MarkText) or, under the sandbox, are confined to the file itself.

## Could not verify

- Any official statement of Typora's or Obsidian's App Sandbox status (both distribute outside the
  App Store; inferred from install paths and download pages only).
- Typora's watch depth and its exact "file changed on disk" behaviour; iA Writer's external-change
  handling beyond release-note one-liners; where iA Writer puts a pasted clipboard image and what it
  does for an untitled Document; whether iA Writer's File → Open on a file outside every Location
  opens it without adding it to the Library.
- Obsidian's runtime behaviour on a Finder double-click of a loose `.md` today (one 2025 user report:
  "Obsidian does nothing"; no help page or staff statement), and what `obsidian://open?path=` does
  when no vault contains the path.
- Zed's image-paste behaviour in a single-file worktree was concluded from `RelPath::parent`
  returning `None` on the empty path, not by running it; Zed's drag-and-drop image import was not
  found but its absence was not proven exhaustively.
- Whether FSEvents on a user-selected file's parent delivers events under the App Sandbox (Apple does
  not document it), and whether a resolved app-scoped bookmark to a directory covers the whole tree
  (Apple documents the folder grant as recursive but says nothing about the resolved bookmark's depth).
- MarkText quotes are from tag `v0.17.1`; `develop` file bodies could not be fetched. The absence of
  sandbox entitlements rests on the file listing and `electron-builder.yml`, not a full-text grep.
- The `markdown.copyFiles.destination` description text in VS Code's `package.nls.json` was read
  through a summarizer rather than the raw JSON line.
