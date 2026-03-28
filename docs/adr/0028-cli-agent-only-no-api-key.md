---
type: ADR
id: "0028"
title: "AI integration via CLI agents only — no API key"
status: active
date: 2026-03-28
supersedes: "0027"
---

## Context

Supersedes [ADR-0027](0027-dual-ai-architecture.md).

The dual AI architecture (direct Anthropic API chat + Claude CLI agent) added two codepaths and required users to manage an Anthropic API key in settings — additional friction and complexity for v1. The lightweight API chat panel provided marginal value over the CLI agent for simple questions. Keeping things simple is the priority for the first version of Laputa.

## Decision

**Remove the direct Anthropic API integration (AIChatPanel, api key settings). AI is available exclusively via Claude CLI subprocess with MCP vault integration (AiPanel).** Future CLI agents (Codex, others) may be added as additional options under the same architecture.

## Options considered

- **Option A** (chosen): CLI-agent only. One codepath, no API key management, Claude CLI handles auth. Simpler settings, simpler codebase.
- **Option B** (prior decision): Dual — API chat + CLI agent. Two codepaths, API key required in settings. Rejected: unnecessary complexity for v1.
- **Option C**: API-only with tool calling. Rejected: complex tool-calling loop, no MCP, more code to maintain.

## Consequences

- Remove `AIChatPanel`, `useAIChat` hook, and Rust `ai_chat` command
- Remove Anthropic API key field from settings UI and `useSettings`
- `AiPanel` + `useAiAgent` → Claude CLI subprocess remains as the single AI interface
- Context builder (`ai-context.ts`) stays — used by the agent
- Future: other CLI agents (Codex, etc.) can be added as options in the same agent panel
- Re-evaluation trigger: Claude CLI becomes unavailable or unreliable; or a lightweight SDK handles both simple chat and tool calling with no key management friction
