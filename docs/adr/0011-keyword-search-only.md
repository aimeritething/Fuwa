---
type: ADR
id: "0011"
title: "Keyword search only (remove QMD semantic indexing)"
status: active
date: 2026-03-24
---

## Context

Laputa originally included QMD (Query Markdown) semantic indexing — a system that parsed markdown structure to enable semantic queries beyond simple keyword matching. The indexing step added startup latency, code complexity, and maintenance burden without delivering significantly better search results for the typical vault usage pattern (finding notes by title or content fragments).

## Decision

**Remove QMD semantic indexing entirely. Search is keyword-based only, using `walkdir` to scan all `.md` files with no indexing step required.**

## Options considered

- **Option A** (chosen): Keyword search via walkdir — pros: zero indexing overhead, no startup delay, simple implementation, sufficient for title + content matching / cons: no semantic ranking, no fuzzy matching beyond case-insensitive substring
- **Option B**: Keep QMD semantic indexing — pros: richer query capabilities / cons: startup delay, complex codebase, rarely used features, maintenance burden
- **Option C**: External search engine (Tantivy, MeiliSearch) — pros: fast full-text search with ranking / cons: external dependency, index management, overkill for current scale

## Consequences

- Vault startup is faster — no indexing step
- Search is simple and predictable: title matches ranked higher than content matches
- No semantic query features (field-specific search, boolean operators)
- The `search_vault` Tauri command runs a blocking scan and returns results sorted by relevance score
- Re-evaluate if vaults grow large enough that scan-based search becomes too slow, or if users need structured queries
