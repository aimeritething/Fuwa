---
type: ADR
id: "0010"
title: "CodeScene code health gates in CI and git hooks"
status: active
date: 2026-03-24
---

## Context

Code complexity was creeping up as features were added rapidly. Manual code review could catch some issues, but there was no automated enforcement of code quality standards. Large functions, deep nesting, and god components were appearing in hotspot files (frequently edited files).

## Decision

**Enforce CodeScene code health scores as automated gates in pre-commit and pre-push hooks: hotspot health >= 9.5, average health >= 9.31. Both gates block commit/push on failure.**

## Options considered

- **Option A** (chosen): CodeScene automated gates in git hooks — pros: catches complexity at commit time, objective thresholds, MCP integration for in-editor feedback, continuous improvement via Boy Scout Rule / cons: can slow down commits, external API dependency, thresholds need periodic tuning
- **Option B**: Manual code review only — pros: no tooling overhead / cons: subjective, inconsistent, doesn't scale with rapid development
- **Option C**: ESLint complexity rules only — pros: free, fast, no API / cons: doesn't measure structural complexity, no cross-language support (Rust), misses higher-level patterns

## Consequences

- Pre-commit hook checks both hotspot and average code health before allowing commits
- Pre-push hook runs the same checks as a safety net
- Developers must fix complexity regressions before committing — even in files they didn't directly modify if their changes affected the average
- `.codesceneignore` excludes test files, scripts, and tool directories from scoring
- CodeScene MCP tools available for checking scores before committing
- Thresholds have been tuned upward over time (8.8 → 8.9 → 9.31 → current) as the codebase improved
- Re-evaluate if CodeScene API latency becomes a bottleneck for commit workflow
