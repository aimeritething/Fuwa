# CLAUDE.md — Laputa App

## ⛔ BEFORE EVERY COMMIT

```bash
pnpm lint && npx tsc --noEmit
pnpm test
pnpm test:coverage                  # frontend ≥70%
cargo test
cargo llvm-cov --manifest-path src-tauri/Cargo.toml --no-clean --fail-under-lines 85
```

**CodeScene Code Health** — the pre-commit and pre-push hooks enforce:
- Hotspot Code Health ≥ 9.5 (most-edited files)
- Average Code Health ≥ 9.31 (project-wide, ALL files)

**Both gates block commit/push.** If either fails: extract hooks, split large components, reduce function complexity. Never add `// eslint-disable`, `#[allow(...)]`, or `as any` to pass the gate. Check both scores via MCP CodeScene after every significant change:
- `hotspot_code_health.now` ≥ 9.5
- `code_health.now` ≥ 9.31 (average — do NOT ignore this one)

If Average Code Health is below 9.0, you must fix regressions before pushing — even in files you didn't directly modify, if your changes indirectly affected complexity.

**Boy Scout Rule (Robert C. Martin):** Leave every file you touch better than you found it. When working on any task:
1. Before modifying a file, check its CodeScene health: `mcp__codescene__code_health_review`
2. If the file has issues (complexity, duplication, large functions), fix them as part of your work
3. After your changes, verify the file's score is higher than before: `mcp__codescene__code_health_score`
4. The goal: every commit either maintains or raises the overall average. No commit should lower it.

This is not optional — it's how we incrementally raise the codebase quality with every task.

## ⛔ BEFORE FIRING laputa-task-done — Two-phase QA

### Phase 1: Playwright (you do this)

Write a test in `tests/smoke/<slug>.spec.ts` that covers every acceptance criterion. The test must fail before your fix and pass after. Run it:

```bash
pnpm dev --port 5201 &
sleep 3
BASE_URL="http://localhost:5201" npx playwright test tests/smoke/<slug>.spec.ts
```

**If your task touches filesystem, git, AI, MCP, or any native Tauri command**: also test with `pnpm tauri dev` against `~/Laputa` (not demo vault). Use `osascript` keyboard events — no mouse, no `cliclick`.

### Phase 2: Native QA (Brian does this after push)

Brian installs the release build and runs keyboard-only QA. Phase 1 must pass first or the task goes to To Rework.

Fire done signal only after Phase 1 passes — **three steps, all required**:

```bash
# 1. Move task to In Review on Todoist
curl -s -X POST "https://api.todoist.com/api/v1/tasks/<task_id>/move" \
  -H "Authorization: Bearer $TODOIST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"section_id": "6g3XjX33FF4Vj86M"}'

# 2. Notify Brian
openclaw system event --text "laputa-task-done:<task_id>" --mode now

# 3. Self-dispatch: pick next task autonomously
# Priority: To Rework first, then Open (sorted by Todoist priority p1→p4)
# Skip To Rework tasks whose last comment is ❌ QA failed with no follow-up human feedback
# If next task found: move it to In Progress and start working on it immediately
# If nothing available: exit — Brian's watchdog (laputa-dispatch cron, hourly) will restart you
python3 - <<'PYEOF'
import os, json, urllib.request, sys

token = os.environ["TODOIST_API_KEY"]

def get_tasks(section_id):
    req = urllib.request.Request(
        f"https://api.todoist.com/api/v1/tasks?project_id=6g3XjQFwv9V8Pxfv&section_id={section_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(req) as r:
        data = json.load(r)
    return data if isinstance(data, list) else data.get("results", [])

def get_comments(task_id):
    req = urllib.request.Request(
        f"https://api.todoist.com/api/v1/comments?task_id={task_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(req) as r:
        data = json.load(r)
    return data if isinstance(data, list) else data.get("results", [])

def skip_rework_task(task_id):
    """Return True if this To Rework task has no follow-up human feedback after the last QA fail."""
    comments = get_comments(task_id)
    last_fail_idx = -1
    for i, c in enumerate(comments):
        if isinstance(c, dict) and "\u274c" in c.get("content", ""):
            last_fail_idx = i
    if last_fail_idx == -1:
        return False  # No QA fail found — can proceed
    after = comments[last_fail_idx + 1:]
    human_keywords = ["feedback", "Luca", "Brian", "\u26a0\ufe0f", "fix", "should", "must", "rework"]
    for c in after:
        if any(kw.lower() in c.get("content", "").lower() for kw in human_keywords):
            return False  # Human weighed in — can proceed
    return True  # No human feedback yet — skip

for section_id, is_rework in [("6g6QqvR9rRpvJWvv", True), ("6g3XjWR832hVHhCM", False)]:
    tasks = sorted(get_tasks(section_id), key=lambda t: t.get("priority", 4), reverse=True)
    for task in tasks:
        if is_rework and skip_rework_task(task["id"]):
            continue
        # Move to In Progress
        req = urllib.request.Request(
            f"https://api.todoist.com/api/v1/tasks/{task['id']}/move",
            data=json.dumps({"section_id": "6g3XjWjfmJFcGgHM"}).encode(),
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req) as r:
            t = json.load(r)
        print(f"NEXT_TASK_ID={t['id']}")
        print(f"NEXT_TASK_TITLE={t['content']}")
        sys.exit(0)

print("NO_TASKS")
PYEOF
```

**After running step 3:** if output contains `NEXT_TASK_ID=...`, read that task's full description from Todoist and implement it (repeating this entire CLAUDE.md flow). If output is `NO_TASKS`, you are done — exit cleanly.

## Project

Tauri v2 + React + TypeScript desktop app. Reads a vault of markdown files with YAML frontmatter.

- **Spec**: `docs/PROJECT-SPEC.md` | **Architecture**: `docs/ARCHITECTURE.md` | **Abstractions**: `docs/ABSTRACTIONS.md`
- **Wireframes**: `ui-design.pen` | **Luca's vault**: `~/Laputa/` (~9200 markdown files)
- Stack: Rust backend, React + BlockNote editor, Vitest + Playwright + cargo test, pnpm

## How to Work

- **Push directly to main** — no PRs ever. The pre-push hook runs all checks.
- **⛔ NEVER open a PR** — branches diverge and cause rebase churn.
- **⛔ NEVER use --no-verify**
- Commit every 20–30 min: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`

## TDD (mandatory)

Red → Green → Refactor → Commit. One cycle per commit. For bugs: write a failing regression test first, then fix. Exception: pure CSS/layout with no logic.

**Test quality (Kent Beck's Desiderata):** every test must be Isolated (no shared state), Deterministic (no flakiness), Fast, Behavioral (tests behavior not implementation), Structure-insensitive (refactoring doesn't break it), Specific (failure points to exact cause), Predictive (all pass = production-ready). Fix flaky/non-deterministic tests before adding new ones. E2E tests over unit tests for user flows.

## ⛔ Docs — Keep docs/ in sync

After adding a Tauri command, new component/hook, data model change, or new integration: update `docs/ARCHITECTURE.md`, `docs/ABSTRACTIONS.md`, and/or `docs/GETTING-STARTED.md` in the same commit. Use Mermaid for diagrams (not ASCII). Exception: spatial wireframe layouts.

## Architecture Decision Records (ADRs)

ADRs live in `docs/adr/`. Before making an architectural choice, check existing ADRs there first.

**When to create one**: storage strategy, new dependency, platform support, core abstraction change, cross-cutting concern. Use `/create-adr` for the full template and instructions.

**Timing**: create the ADR **in the same commit as the code** that implements the decision — never before, never after. An ADR committed without the corresponding code is invalid.

**When your work supersedes an existing ADR**: do not edit the existing file — use `/create-adr` which covers the superseding flow.

**Do not create ADRs for**: bug fixes, UI styling, refactors, or test additions.

## Design File (UI tasks)

1. Open `ui-design.pen` first — study existing frames for visual language.
2. Design in light mode. Create `design/<slug>.pen` for the task.
3. On merge to main: merge frames into `ui-design.pen`, delete `design/<slug>.pen`.

## ⛔ Never modify the user vault for testing

`~/Laputa/` is Luca's real vault. **Never create, edit, or delete notes there for testing purposes.**

Use the demo vault for all testing:
- Playwright / Vitest: use the fixtures in `tests/` or `demo-vault-v2/`
- `pnpm tauri dev` manual testing: open `demo-vault-v2/` as the vault, not `~/Laputa/`
- If a test genuinely requires the real vault (e.g. verifying git history), read only — never write

Any commit that touches `~/Laputa/` content is a bug. If you accidentally created test notes there, delete them before committing.

## Vault Retrocompatibility

Every feature that depends on vault files must auto-bootstrap: check if file/folder exists on vault open, create with defaults if missing (silent, idempotent). Register with the central `Cmd+K → "Repair Vault"` command.

## Keyboard-First + Menu Bar (mandatory)

Every feature must be reachable via keyboard. Every new command palette entry must also appear in the macOS menu bar (File / Edit / View / Note / Vault / Window). This is a QA requirement.

## macOS / Tauri Gotchas

- `Option+N` → special chars on macOS. Use `e.code` or `Cmd+N`.
- Tauri menu accelerators: `MenuItemBuilder::new(label).accelerator("CmdOrCtrl+1")`.
- `app.set_menu()` replaces the ENTIRE menu bar — include all submenus.
- `mock-tauri.ts` silently swallows Tauri calls — not a substitute for native app testing.

## QA Scripts

```bash
bash ~/.openclaw/skills/laputa-qa/scripts/focus-app.sh laputa
bash ~/.openclaw/skills/laputa-qa/scripts/screenshot.sh /tmp/out.png
bash ~/.openclaw/skills/laputa-qa/scripts/shortcut.sh "command" "s"
```

## Documentation Diagrams

Prefer Mermaid for all diagrams (`flowchart`, `sequenceDiagram`, `classDiagram`, `stateDiagram-v2`). ASCII only for spatial wireframe layouts. GitHub renders Mermaid natively.
