---
type: ADR
id: "0020"
title: "AI dual architecture (chat + agent)"
status: active
date: 2026-02-14
---

## Context

Users need AI assistance in two distinct modes: quick questions about their notes (lightweight chat) and complex multi-step operations on the vault (agent with tool access). A single AI interface cannot serve both use cases well — chat needs to be fast and cheap, while agent mode needs full tool execution and reasoning.

## Decision

**Provide two AI interfaces: AI Chat (direct Anthropic API, no tools, streaming text) and AI Agent (Claude CLI subprocess with MCP tools, NDJSON streaming, reasoning blocks, and tool action cards).**

## Options considered

- **Option A** (chosen): Dual interface (Chat + Agent) — pros: right tool for each job, chat is fast/cheap (Haiku default), agent has full tool access via MCP, clear UX separation / cons: two codepaths to maintain, two UIs in the inspector panel
- **Option B**: Agent-only (always use Claude CLI) — pros: one interface / cons: overkill for simple questions, slower startup, higher cost, requires Claude CLI installation
- **Option C**: Chat-only (API with function calling) — pros: simpler / cons: no file editing, no vault-wide operations, limited by API context window

## Consequences

- AI Chat: `AIChatPanel` + `useAIChat` — Anthropic API via Vite proxy (dev) or Rust `ai_chat` command (Tauri)
- AI Agent: `AiPanel` + `useAiAgent` — spawns Claude CLI as subprocess, streams NDJSON events
- Agent gets MCP vault tools via `--mcp-config` flag — search, read, edit, create notes
- Context building: `ai-context.ts` builds structured snapshot (active note, linked notes, open tabs, vault metadata)
- Three model options for chat: Haiku 3.5 (default), Sonnet 4, Opus 4
- Agent mode detects file operations from tool inputs and triggers vault reload
- Toggle between Inspector, Chat, and Agent via breadcrumb bar sparkle icon
- Re-evaluate if function calling in the Anthropic API matures enough to replace the CLI subprocess approach
