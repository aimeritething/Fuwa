# CLAUDE.md — Laputa Vault Guide

This file explains how Laputa vaults work so you can create and edit notes correctly.

## Note structure

Every note is a markdown file with YAML frontmatter:

```yaml
---
title: My Note Title        # required — do NOT use H1 in the body
is_a: TypeName              # the note's type (must match a type file in the vault)
status: Active              # example property
url: https://example.com   # example property
belongs_to: "[[Other Note]]"  # relationship via wikilink
related_to:
  - "[[Note A]]"
  - "[[Note B]]"
---

Body content in markdown. No H1 — the title is in the frontmatter.
```

**Key rules:**
- `title` is the note's display name — never use `# H1` in the body
- `is_a` must match the `title` of an existing type file
- Properties are any YAML key-value pairs in the frontmatter
- System properties are prefixed with `_` (e.g. `_pinned`, `_organized`, `_icon`) — don't show these to users

## Types

A type is a note with `is_a: Type` in the frontmatter. It lives in the vault root:

```yaml
---
title: Book
is_a: Type
_icon: BookOpen          # Phosphor icon name
_color: "#8b5cf6"        # hex color for sidebar
---
Description of the type.
```

To create a new type: create a markdown file with `is_a: Type`.

## Relationships

Relationships are frontmatter properties whose values are wikilinks:

```yaml
belongs_to: "[[Project Name]]"
related_to:
  - "[[Note A]]"
  - "[[Note B]]"
has:
  - "[[Child Note]]"
```

Standard names: `belongs_to`, `related_to`, `has`. Custom names are allowed.

## Wikilinks

Syntax: `[[Note Title]]` or `[[filename]]`. Used for relationships and inline references.

## Views

Saved filters stored as `.view.json` in the `views/` folder:

```json
{
  "title": "Active Notes",
  "filters": [
    {"property": "is_a", "operator": "equals", "value": "Note"},
    {"property": "status", "operator": "equals", "value": "Active"}
  ],
  "sort": {"property": "title", "direction": "asc"}
}
```

## What you can do on this vault

- Create/edit notes with correct frontmatter
- Create new type files
- Add or modify relationships between notes
- Create/edit views in `views/`
- Change `_icon` and `_color` on type files
- Edit `CLAUDE.md` (this file)

**Do not** modify app configuration files — those are local to each installation.
