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
- **Rust** (`cargo test` in `src-tauri/`): the inline `mod tests` per module.
- **Smoke** (`pnpm smoke`): Playwright drives the whole React app in Chromium against
  `pnpm dev`, with an in-memory Folder fixture standing in for the Rust side. See
  [tests/smoke/README.md](tests/smoke/README.md).

CI (`.github/workflows/ci.yml`) runs the type-check, ESLint, Vitest, clippy and `cargo test`
on macOS for every push to `main` and every pull request. Smoke and the bundle build are run
by hand.

## License

AGPL-3.0-or-later — see [LICENSE](LICENSE), with attribution in [NOTICE.md](NOTICE.md).
