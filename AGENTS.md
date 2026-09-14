# AGENTS.md

Guidance for AI coding agents working in this repository.

## Repo overview

Fuwa is a small macOS desktop app for reading and editing Markdown Documents in a Folder
on disk. Directory names follow the glossary in `CONTEXT.md`.

- `src/` — the React app, cut by feature. Inside each directory files sit flat; cross-directory
  imports use `@/<dir>/…`, imports within a directory are relative.
  - `kernel/` — the Kernel: the ProseMirror, BlockNote and CodeMirror code and the Markdown
    round-trip. `blocknote/` (schema, blocks, extensions, menus, copy/paste, find, the BlockNote
    regression tests), `markdown/` (the round-trip: frontmatter, fences, wikilinks, per-block
    serializers), `resolve/` (the open-time pipeline: cache, preload, worker, swap), `raw/`
    (CodeMirror).
  - `editor/` — Fuwa's editing surface: `editor.tsx`, Rich / Raw views, Autosave, Write failure,
    Toast, an Image file's Tab.
  - `explorer/`, `folder/` (disk: `use-folder`, the watcher, asset scope, the Rust command
    wrappers; `explorer/` imports `folder/`, never the reverse), `tabs/`, `session/`,
    `command-menu/`, `shell/` (sidebar, theme, shortcuts, menu events, `app-command-manifest.json`,
    which `src-tauri/src/menu.rs` also reads via `include_str!`).
  - `ui/` — the shadcn primitives, regenerated from the templates with Fuwa's values, and
    `kbd`. `platform/` — `tauri.ts` (`isTauri` / mock dispatch), `mock/` (the in-memory Folder
    fixture that stands in for Rust outside Tauri), window, URL, clipboard, storage keys.
    `lib/` — leaf helpers (`cn`, i18n, telemetry stubs, path identity).
- `src-tauri/` — the Rust side: commands, the Folder watcher, the Session file, the menu.
- `tests/smoke/` — Playwright specs; its `README.md` describes the Folder fixture they drive.
  Unit tests sit beside the code as `*.test.ts(x)`; a test with no source file of its own lives
  in the directory it guards; test helpers are `*.test-utils.ts(x)`. File names are kebab-case.
- `docs/adr/` — decisions; read the ones touching the area you change.
  `docs/agents/` — domain-doc conventions and where issues are tracked (`issue-tracker.md`).
- `patches/` — six pnpm patches on BlockNote, TipTap and prosemirror-tables, pinned in
  `pnpm-workspace.yaml`. Bumping those packages means re-applying the patches.

## Setup

pnpm 10.33, node >= 22, Rust >= 1.77.2. `pnpm install` applies the patches. The Vite dev
server listens on port 5202; outside Tauri every command goes to the mock Folder fixture.

## Common commands

| Command | Notes |
| -- | -- |
| `pnpm tauri dev` | The full app. The wrapper adds `src-tauri/tauri.dev.conf.json` (identifier `com.aimerite.fuwa.dev`) so a dev build never collides with an installed Fuwa. |
| `pnpm dev` | Frontend only, in the browser, against the mock fixture. |
| `pnpm tsc` / `pnpm lint` / `pnpm test` | Type-check, ESLint (warnings fail the run), Vitest. |
| `cargo clippy --all-targets` / `cargo test` | Run in `src-tauri/`. |
| `pnpm smoke` | Playwright in Chromium. Manual, not in CI. Set `FUWA_SMOKE_PORT` when 5202 is taken. |
| `pnpm tauri build` | The `.app` bundle. Manual. |

CI runs tsc, ESLint, Vitest, clippy and `cargo test` on every push and pull request; run
the same set locally before calling work done.
