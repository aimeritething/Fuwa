# AGENTS.md

Guidance for AI coding agents working in this repository.

## Repo overview

Fuwa is a small macOS desktop app for reading and editing Markdown Documents in a Folder
on disk. 

- `src/` — the React app. Fuwa-authored code lives beside the ported Tolaria files.
- `src-tauri/` — the Rust side: commands, the Folder watcher, the Session file, the menu.
- `src/mock-tauri/` — the in-memory Folder fixture that stands in for Rust outside Tauri.
- `tests/smoke/` — Playwright specs. Unit tests sit beside the code as `*.test.ts(x)`.
- `docs/adr/` — decisions; read the ones touching the area you change.
  `docs/agents/` — issue tracker (Linear, `AIM-` ids) and domain-doc conventions.
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
