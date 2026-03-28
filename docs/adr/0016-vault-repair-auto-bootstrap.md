---
type: ADR
id: "0016"
title: "Vault repair and auto-bootstrap"
status: active
date: 2026-03-16
---

## Context

As Laputa evolved (flat vault migration, frontmatter format changes, theme seeding, config folder structure), existing vaults could end up in inconsistent states. Users shouldn't need to manually fix their vault structure after app updates. New features that depend on vault files (type definitions, config files, themes) need those files to exist.

## Decision

**Every feature that depends on vault files must auto-bootstrap: check if the file/folder exists on vault open, create with defaults if missing (silent, idempotent). A central `Cmd+K → "Repair Vault"` command runs all repairs at once.**

## Options considered

- **Option A** (chosen): Auto-bootstrap + central repair command — pros: self-healing, idempotent, no manual intervention, progressive vault upgrades / cons: startup has repair overhead (mitigated by fast checks), silent creation may surprise users
- **Option B**: Migration scripts run once per version — pros: explicit, one-time cost / cons: users who skip versions miss migrations, requires version tracking in vault
- **Option C**: Require manual vault setup — pros: user is in full control / cons: terrible UX, support burden, breaks on every structural change

## Consequences

- `repair_vault` Tauri command: flattens stray files, migrates legacy frontmatter (`Is A:` → `type:`), restores themes and config files
- `vault_health_check` detects stray files in non-protected subfolders and filename-title mismatches
- On vault load, a migration banner offers to flatten stray files to the root
- `run_startup_tasks()` in `lib.rs`: purges trash, seeds themes, registers MCP — all idempotent
- Config seeding (`config_seed.rs`): creates `config/` folder, migrates `AGENTS.md`, repairs missing config files
- All new features must register their bootstrap logic with the repair command
- Re-evaluate if startup repair overhead becomes noticeable on large vaults
