# ADR-0170: Measurable, crash-safe startup

**Status:** Active

**Date:** 2026-07-21

**Extends:** [ADR-0166](0166-snapshot-first-progressive-vault-startup.md)

## Context

Snapshot-first startup removed the intentional loading gate, but a real vault could still take more than ten seconds to become usable. The existing timestamps did not separate renderer progress from time spent waiting on the native command queue, so the delay could not be attributed reliably.

Native profiling showed several independent costs: startup selected the legacy default vault before the persisted registry loaded, the editor chunk loaded without an active note, Git capability probing performed blocking work on the command thread, and Git environment discovery launched a login shell once per missing variable. Reload also deleted the previous cache before its replacement scan completed, so closing the app during reconciliation could turn the next launch into another full scan.

## Decision

- Record ordered, path-free milestones from renderer initialization through settings, vault registry, snapshot hydration, app interactivity, optional editor readiness, and background reconciliation. Store native-process and renderer-relative elapsed time together, and expose structured stderr output behind `TOLARIA_STARTUP_TRACE=1`.
- Do not begin vault loading until the persisted vault registry has selected the active workspace.
- Treat a valid snapshot as usable when Gitignored content is hidden; apply the visibility filter at the command boundary on the blocking pool.
- Keep BlockNote and editor-only assets out of the initial shell chunk, then prewarm them after the shell commit; an active note bypasses that wait.
- Batch missing Git environment variables into one login-shell invocation and move repository detection to the blocking Tokio pool.
- Rebuild explicit reloads transactionally: retain the previous snapshot during the scan and atomically replace it only when the new cache is complete and still based on the expected fingerprint.

## Consequences

Warm startup has a measurable interactive milestone that can be compared across builds without logging vault paths or note content. The native and renderer clocks reveal command-queue stalls, while optional editor milestones keep no-note launches distinct from note restoration.

The active workspace no longer pays for an unused default-vault scan, Git environment lookup has one shell-startup cost instead of one per variable, and a reload interrupted by process exit leaves the last valid startup snapshot intact. Snapshot data remains provisional: authoritative background reconciliation still replaces React state when it completes.

The cache can temporarily describe the filesystem state from the previous successful reconciliation while a reload is running. This is acceptable because it is used only for provisional startup hydration, remains reconstructible, and is replaced atomically when the current scan succeeds.
