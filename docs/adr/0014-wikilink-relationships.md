---
type: ADR
id: "0014"
title: "Wikilink-based relationship model"
status: active
date: 2026-02-14
---

## Context

Laputa needs a way to express relationships between notes (belongs-to, related-to, custom relationships). The relationship model must be plain-text friendly, work without a database, and be extensible without code changes.

## Decision

**Relationships are expressed as `[[wikilinks]]` in frontmatter fields. Any frontmatter field containing `[[target]]` values is automatically detected as a relationship field — no hardcoded field name lists.**

## Options considered

- **Option A** (chosen): Wikilink syntax in frontmatter, dynamic detection — pros: extensible (any field name works), human-readable, no schema needed, Obsidian-compatible syntax / cons: relies on string parsing, `[[` in non-relationship fields could cause false positives
- **Option B**: Explicit relationship schema (config file listing relationship fields) — pros: no false positives / cons: requires configuration, new relationships need config changes
- **Option C**: Database-backed graph — pros: fast traversal, proper graph queries / cons: violates filesystem-as-source-of-truth principle (ADR-0002)

## Consequences

- Standard relationships: `belongs_to`, `related_to` (with wikilink values) shown in Properties panel
- Custom relationships: any frontmatter key with `[[wikilink]]` values captured in `relationships` HashMap
- Wikilink resolution uses multi-pass matching: filename stem -> alias -> exact title -> humanized title
- Outgoing links: `[[wikilinks]]` in note body extracted separately for backlink detection
- Backlinks panel scans `allContent` for notes referencing the current note
- No hardcoded field names — relationship detection is purely syntactic
- Re-evaluate if false-positive relationship detection becomes a user-facing issue
