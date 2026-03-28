---
type: ADR
id: "0015"
title: "Note type system (types as files)"
status: active
date: 2026-02-14
---

## Context

Laputa organizes notes by entity type (Project, Person, Procedure, Topic, etc.). The type system needs to support custom types, per-type configuration (icon, color, sort order, templates), and be editable without code changes. Following the filesystem-as-source-of-truth principle (ADR-0002), type definitions should be stored as plain files.

## Decision

**Each entity type is defined by a type document in `type/` (e.g., `type/project.md`) with `type: Type` frontmatter. Notes declare their type via the `type:` frontmatter field. Type is never inferred from folder location (ADR-0006).**

## Options considered

- **Option A** (chosen): Types as markdown files in `type/` folder — pros: editable by users, follows filesystem principle, type metadata is frontmatter, type documents are navigable notes / cons: type discovery requires scanning `type/` folder, type document format must be documented
- **Option B**: Type definitions in a config JSON/YAML file — pros: single source, fast to parse / cons: not a note, not navigable, breaks the "everything is a markdown file" principle
- **Option C**: Hardcoded type list in source code — pros: simplest / cons: no customization, every new type requires a code change

## Consequences

- Type documents define: `_icon`, `_color`, `_order`, `_sidebar_label`, template, sort, view, visibility
- Sidebar section groups auto-generated from type documents — no code change needed for new types
- Changing a note's type requires only updating `type:` in frontmatter (no file moves per ADR-0006)
- The Rust backend adds a `"Type"` relationship entry linking each note to its type document
- Type documents are themselves navigable — viewing one shows an "Instances" section listing all notes of that type
- Legacy `Is A:` field accepted as alias for `type:` for backwards compatibility
- Re-evaluate if the type system needs inheritance or multi-type support
