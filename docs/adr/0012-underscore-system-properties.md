---
type: ADR
id: "0012"
title: "Underscore convention for system properties"
status: active
date: 2026-03-24
---

## Context

As Laputa added more internal configuration stored in note frontmatter (type icons, colors, pinned properties, sidebar labels), these system fields cluttered the user-facing Properties panel alongside user-defined fields. There was no convention to distinguish system-internal fields from user-visible ones.

## Decision

**Any frontmatter field whose name starts with `_` is a system property: hidden from the Properties panel, not exposed in search or filters, but editable in the raw editor. All future system-level frontmatter fields must use the `_field_name` convention.**

## Options considered

- **Option A** (chosen): Underscore prefix convention (`_icon`, `_color`, `_order`) — pros: simple, familiar (Unix hidden files), no schema needed, parsers just filter on prefix / cons: relies on naming discipline, no enforcement beyond convention
- **Option B**: Separate YAML block or nested key (e.g., `system:` namespace) — pros: clean separation / cons: breaks flat key-value assumption, complicates frontmatter parsing
- **Option C**: Store system config in separate sidecar files — pros: clean frontmatter / cons: doubles file count for type notes, harder to keep in sync

## Consequences

- Frontmatter parsers (Rust and TypeScript) filter `_*` fields before passing properties to the UI
- System properties are still plain YAML — readable and editable by humans and external tools
- Power users can modify system properties via the raw editor
- Examples: `_icon`, `_color`, `_order`, `_sidebar_label`, `_pinned_properties`
- All new features that need per-note or per-type configuration must use this convention
- Re-evaluate if the number of system properties grows large enough to warrant a nested namespace
