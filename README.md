# Laputa App

Personal knowledge and life management desktop app built with Tauri v2 + React + TypeScript + BlockNote.

## Documentation

- 📐 [ARCHITECTURE.md](docs/ARCHITECTURE.md) — System design, tech stack, data flow
- 🧩 [ABSTRACTIONS.md](docs/ABSTRACTIONS.md) — Core abstractions and models
- 🚀 [GETTING-STARTED.md](docs/GETTING-STARTED.md) — How to navigate the codebase
- 🎨 [THEMING.md](docs/THEMING.md) — Theme system and customization

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Rust (latest stable)
- macOS (for development)

### Setup

```bash
# Install dependencies
pnpm install

# Run dev server
pnpm dev

# Open in browser (mock mode)
open http://localhost:5173

# Or run in Tauri
pnpm tauri dev
```

### Testing

```bash
# Frontend tests
pnpm test

# Backend tests
cargo test

# Coverage
pnpm test:coverage

# E2E tests
pnpm test:e2e
```

### Code Quality

```bash
# Lint
pnpm lint

# Rust checks
cargo clippy
cargo fmt --check

# CodeScene (via Claude Code)
claude 'Check code health with CodeScene MCP'
```

## Development Workflow

See [AGENTS.md](AGENTS.md) for coding guidelines and workflow. [CLAUDE.md](CLAUDE.md) remains as a compatibility shim for Claude Code.

**Key principles:**
- Small, atomic commits
- Test as you go
- Visual verification mandatory
- Documentation updated with code changes

## CI/CD

GitHub Actions runs on every push to `main`:
- ✅ Tests (frontend + Rust)
- 📊 Coverage (70% threshold)
- 🎨 Lint & format
- ⚠️ Documentation check

See [.github/SETUP.md](.github/SETUP.md) for CI/CD configuration.

## Git Hooks

Husky installs the git hooks from `.husky/` during `pnpm install`. The repo enforces `main`-only commits and pushes; see [.github/HOOKS.md](.github/HOOKS.md) for details.

## License

Private repository — not licensed for public use.
