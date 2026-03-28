---
type: ADR
id: "0019"
title: "MCP server for AI integration"
status: active
date: 2026-03-01
---

## Context

AI assistants (Claude Code, Cursor) are increasingly part of the development and knowledge management workflow. To make the vault accessible to these tools, Laputa needed to expose vault operations as a standardized tool interface. The Model Context Protocol (MCP) provides exactly this — a standard way for AI clients to discover and call tools.

## Decision

**Ship an MCP server (`mcp-server/`) as a Node.js process that exposes 14 vault tools via stdio transport, with a WebSocket bridge for live UI integration. Auto-register in Claude Code and Cursor configs on startup.**

## Options considered

- **Option A** (chosen): MCP server with stdio + WebSocket — pros: standard protocol, works with Claude Code and Cursor out of the box, WebSocket bridge enables live UI actions from AI, auto-registration is frictionless / cons: Node.js dependency alongside Rust backend, two transport layers to maintain
- **Option B**: REST API — pros: simpler, widely understood / cons: not a standard AI tool protocol, would need custom integration per AI client
- **Option C**: Expose tools only via Claude CLI MCP config — pros: no separate server / cons: no WebSocket bridge, no live UI actions, limited to Claude CLI

## Consequences

- 14 tools: vault CRUD, search, frontmatter editing, note linking, UI actions (open note, highlight, set filter)
- Two transports: stdio (Claude Code/Cursor) and WebSocket (port 9710 for tools, 9711 for UI actions)
- Auto-registration in `~/.claude/mcp.json` and `~/.cursor/mcp.json` — non-destructive upsert
- `mcp.rs` manages lifecycle: spawn on startup, kill on exit
- `useMcpBridge` and `useAiActivity` hooks connect frontend to WebSocket bridge
- MCP server reads/writes vault files directly — Tauri backend not involved in MCP tool execution
- Re-evaluate if MCP protocol evolves to support binary transport or if vault operations need Tauri backend involvement
