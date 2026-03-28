---
type: ADR
id: "0007"
title: "Opt-in telemetry via Sentry and PostHog"
status: active
date: 2026-03-25
---

## Context

Laputa had no visibility into crashes or usage patterns. Bug reports from users were the only signal, often missing reproduction steps or environment details. We needed crash reporting and basic analytics while respecting user privacy — this is a personal knowledge management tool with sensitive data.

## Decision

**Integrate Sentry for crash reporting and PostHog for usage analytics, both strictly opt-in. No telemetry is sent without explicit user consent via a first-launch dialog.**

## Options considered

- **Option A** (chosen): Sentry + PostHog, opt-in with consent dialog — pros: industry-standard tools, granular control (crash reporting and analytics toggle independently), path scrubbing prevents vault content leakage / cons: two third-party dependencies, requires DSN/key management
- **Option B**: Self-hosted error tracking — pros: full data control / cons: infrastructure overhead, not justified at current scale
- **Option C**: No telemetry — pros: simplest, zero privacy risk / cons: flying blind on crashes, no usage data for prioritization

## Consequences

- First launch shows `TelemetryConsentDialog` — accept generates a local `anonymous_id` (UUID), decline means zero network requests
- Users can toggle crash reporting and analytics independently in Settings
- `beforeSend` hooks in both Rust and JS scrub file paths and note titles from payloads
- PostHog configured with `autocapture: false`, `persistence: 'memory'`, no cookies
- Dual-layer initialization: Rust-side Sentry in `lib.rs` setup, JS-side Sentry + PostHog via `useTelemetry` hook
- Re-evaluate if we need server-side event processing or if client-side scrubbing is insufficient
