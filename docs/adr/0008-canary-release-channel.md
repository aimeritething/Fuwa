---
type: ADR
id: "0008"
title: "Canary release channel for early testing"
status: active
date: 2026-03-25
---

## Context

All users received the same builds from `main`. There was no way to test new features with a subset of users before a full rollout, and no mechanism to ship experimental builds without risking stability for everyone.

## Decision

**Support two release channels — Stable (default, from `main`) and Canary (from `canary` branch) — with independent CI/CD pipelines and update manifests.**

## Options considered

- **Option A** (chosen): Two-channel release (stable + canary) — pros: early feedback loop, canary users opt in explicitly, independent build pipelines, semver prerelease tags (`-canary`) / cons: two CI workflows to maintain, canary updates are manual download (not auto-update)
- **Option B**: Single channel with feature flags only — pros: one build pipeline / cons: no way to test platform/build-level changes, feature flags don't cover Rust changes
- **Option C**: Beta program via TestFlight — pros: native distribution / cons: Apple-only, review delays, doesn't match the direct-download model

## Consequences

- `release.yml` builds from `main` → `latest.json` on GitHub Pages (Tauri auto-update)
- `release-canary.yml` builds from `canary` → `latest-canary.json` (manual download via release page)
- `update_channel` stored in Settings, configurable in Settings panel
- Canary versions use semver prerelease: `0.YYYYMMDD.N-canary`
- Stable users get seamless auto-update via Tauri updater plugin; canary users get a notification with a link to download
- Re-evaluate if canary adoption grows enough to justify auto-update support for canary channel
