# Fuwa

A small desktop app for reading and editing Markdown Documents in a Folder on your disk.

## Prerequisites

pnpm 10.33, node >= 22, rust 1.77.2.

## Commands

`pnpm install` to set up, `pnpm tauri dev` to run the app, `pnpm tsc` to type-check,
`pnpm lint` to lint, `pnpm test` to run the unit tests, `pnpm smoke` to run the browser
smoke specs. In `src-tauri/`: `cargo build`, `cargo clippy`, `cargo test`.

## Tests

- **Unit** (`pnpm test`): Vitest in jsdom over the `*.test.ts(x)` files beside the code.
  Most are carried from Tolaria and are the reason the kernel is copied verbatim.
- **Rust** (`cargo test` in `src-tauri/`): the inline `mod tests` per module.
- **Smoke** (`pnpm smoke`, which first fetches Chromium if it is missing): Playwright
  drives the whole React app in Chromium against `pnpm dev`, one worker, local only. Specs
  live in `tests/smoke`. Outside Tauri every command goes to the in-memory Folder fixture in
  `src/mock-tauri/vaultFixture.ts`, which answers `list_files`, `get_note_content`,
  `save_note_content`, `list_vault_folders`, `start_vault_watcher`, `stop_vault_watcher` and
  `take_pending_open` from memory and rejects anything else. Argument and result shapes
  follow the Rust commands; `list_files` and `take_pending_open` have no Rust side yet, so
  the fixture's shape is the one their Rust commands should match. A spec reaches it as
  `window.__fuwaMockVault`: call `reset(seed)` to seed files, `writeNote(path, content)` to
  add one, `queuePendingOpen(paths)` to simulate a Finder open, `queueDialogSelection(paths)`
  to decide what the next Open Document… dialog "returns" (the dialog is a plugin call with
  no command behind it, so the fixture stands in for it too), and read `calls` to assert
  what the app invoked. Add a case to the fixture's `answer` switch when a spec needs a
  command it does not answer yet.

CI (`.github/workflows/ci.yml`) runs the type-check, ESLint, Vitest, clippy and `cargo test`
on macOS for every push to `main` and every pull request. Smoke and the bundle build are run
by hand; the measured bundle numbers are in `docs/build-baseline.md`.

## License

AGPL-3.0-or-later — see [LICENSE](LICENSE), with attribution in [NOTICE.md](NOTICE.md).
