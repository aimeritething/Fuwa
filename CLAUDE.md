# CLAUDE.md — Laputa App

> Quick links: [Project Spec](docs/PROJECT-SPEC.md) · [Architecture](docs/ARCHITECTURE.md) · [Abstractions](docs/ABSTRACTIONS.md) · [Wireframes](ui-design.pen)

---

## 1. Task Workflow

### 1a. Pick up a task

Run `/laputa-next-task` — fetches next task (To Rework first, then Open), moves to In Progress, returns full description.

- Read task description and all comments fully
- For To Rework: the ❌ QA failed comment tells you exactly what to fix
- Check `docs/adr/` for relevant architecture decisions before structural choices
- Add a comment: `🚀 Starting work on this task. [Brief description of approach]`

### 1b. Implement

- Work on `main` branch — **no branches, no PRs, ever**
- Commit every 20–30 min: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- **⛔ NEVER use --no-verify**
- For UI tasks: open `ui-design.pen` first, study visual language, design in light mode

### 1c. When done

**Phase 1 — Playwright (only for core user flows):**

Write smoke test in `tests/smoke/<slug>.spec.ts` only if feature touches: vault open, note create/save/delete, search, wikilink navigation, git commit/push, conflict resolution. Do NOT write Playwright tests for cosmetic changes — use Vitest instead. Suite must stay under **10 minutes**.

```bash
pnpm dev --port 5201 &
sleep 3
BASE_URL="http://localhost:5201" npx playwright test tests/smoke/<slug>.spec.ts
```

**Phase 2 — Native app QA:**

```bash
pnpm tauri dev &
sleep 10
bash ~/.openclaw/skills/laputa-qa/scripts/focus-app.sh laputa
bash ~/.openclaw/skills/laputa-qa/scripts/screenshot.sh /tmp/qa-native.png
```

Use `osascript` for keyboard interactions. Write result as Todoist comment (✅ or ❌). **⚠️ WKWebView:** `osascript keystroke` blocked inside editor — rely on Playwright for text input features.

After both phases pass, run `/laputa-done <task_id>` → moves to In Review, notifies Brian, self-dispatches next task.

---

## 2. Development Process

### Commits & pushes

- Push directly to `main` — no PRs, no branches
- Pre-push hook runs full check suite (build + tests + Playwright + CodeScene)
- **A task is NOT done until `git push origin main` succeeds.** If the hook blocks: read the error, fix it (clippy, tests, CodeScene, build), commit the fix, push again. Never use `--no-verify`.
- **⛔ NEVER use --no-verify**

### TDD (mandatory)

Red → Green → Refactor → Commit. One cycle per commit. For bugs: write failing regression test first, then fix. Exception: pure CSS/layout changes.

**Test quality (Kent Beck's Desiderata):** Isolated · Deterministic · Fast · Behavioral · Structure-insensitive · Specific · Predictive. Fix flaky tests before adding new ones. Prefer E2E over unit tests for user flows.

### Code health (mandatory)

Pre-commit and pre-push hooks enforce **Hotspot Code Health** and **Average Code Health** ≥ thresholds in `.codescene-thresholds`. Both gates block commit/push. Thresholds are a **ratchet** — only go up, auto-updated after each successful push. Never add `// eslint-disable`, `#[allow(...)]`, or `as any`.

**Before every commit:**
- `mcp__codescene__code_health_review` — check file before touching
- `mcp__codescene__code_health_score` — verify score is higher after changes

**Boy Scout Rule:** every file you touch must leave with a higher score. If Average drops below 9.0, fix regressions before pushing.

### Check suite (runs on every push)
```bash
pnpm lint && npx tsc --noEmit
pnpm test
pnpm test:coverage        # frontend ≥70%
cargo test
cargo llvm-cov --manifest-path src-tauri/Cargo.toml --no-clean --fail-under-lines 85
```

### Architecture Decision Records (ADRs)

ADRs live in `docs/adr/`. Check before structural choices. Create the ADR **in the same commit as the code**. Never edit existing ADRs — create a new one that supersedes. Use `/create-adr` for template.

**When to create one:** new dependency, storage strategy, platform target, core abstraction change, cross-cutting pattern. **Not for:** bug fixes, UI styling, refactors, test additions.

### Keep docs/ in sync

After Tauri command, new component/hook, data model change, or new integration: update `docs/ARCHITECTURE.md`, `docs/ABSTRACTIONS.md`, and/or `docs/GETTING-STARTED.md` in the same commit.

---

## 3. Product Rules

### User vault (`~/Laputa/`)

Default to `demo-vault-v2/`. If you must use `~/Laputa/` for testing: **never commit changes** — always run `cd ~/Laputa && git checkout -- . && git clean -fd` when done.

### UI design

1. Open `ui-design.pen` first — study existing frames for visual language
2. Design in light mode. Create `design/<slug>.pen` for the task
3. On completion: merge frames into `ui-design.pen`, delete `design/<slug>.pen`

---

## 4. Reference

### macOS / Tauri gotchas

- `Option+N` → special chars on macOS. Use `e.code` or `Cmd+N`
- Tauri menu accelerators: `MenuItemBuilder::new(label).accelerator("CmdOrCtrl+1")`
- `app.set_menu()` replaces the ENTIRE menu bar — include all submenus
- `mock-tauri.ts` silently swallows Tauri calls — not a substitute for native testing

### QA scripts

```bash
bash ~/.openclaw/skills/laputa-qa/scripts/focus-app.sh laputa
bash ~/.openclaw/skills/laputa-qa/scripts/screenshot.sh /tmp/out.png
bash ~/.openclaw/skills/laputa-qa/scripts/shortcut.sh "command" "s"
```

### Diagrams

Prefer Mermaid (`flowchart`, `sequenceDiagram`, `classDiagram`, `stateDiagram-v2`). ASCII only for spatial wireframe layouts.
