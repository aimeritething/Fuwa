---
type: ADR
id: "0009"
title: "Local feature flags (no remote dependency)"
status: active
date: 2026-03-25
---

## Context

We needed a way to gate unfinished features behind flags during development and QA without shipping them to all users. Remote feature flag services (LaunchDarkly, PostHog flags) add network dependencies, privacy concerns, and complexity disproportionate to a single-developer desktop app.

## Decision

**Use a local-only feature flag system based on compile-time defaults with `localStorage` overrides. No remote fetching, no external dependencies.**

## Options considered

- **Option A** (chosen): Local flags with `localStorage` override — pros: zero network requests, zero privacy concerns, instant toggle for dev/QA, type-safe via TypeScript union, trivial implementation / cons: no remote rollout control, no gradual rollout percentage
- **Option B**: PostHog feature flags — pros: remote control, gradual rollout, A/B testing / cons: adds network dependency, privacy implications, overkill for single-developer project
- **Option C**: Build-time flags only (no runtime override) — pros: simplest / cons: requires rebuild to toggle, bad for QA

## Consequences

- `useFeatureFlag(name)` hook checks `localStorage` key `ff_<name>`, falls back to `FLAG_DEFAULTS`
- `FeatureFlagName` TypeScript union type enforces valid flag names at compile time
- QA can toggle flags via browser DevTools without rebuilding
- API surface is designed to be compatible with future migration to remote flags if needed
- No gradual rollout capability — flags are binary (on/off) per installation
- Re-evaluate if user base grows enough to need remote control or percentage-based rollouts
