---
title: Using the Editor
is_a: Note
belongs_to: "[[Getting Started]]"
---

Laputa uses a rich markdown editor. Every note has two parts: **frontmatter** and **body**.

## Frontmatter

The YAML block at the top (between `---`) stores metadata:

```yaml
---
title: My Note
is_a: Note
status: Active
belongs_to: "[[Some Project]]"
---
```

- `title` — the note's display name (no H1 needed in the body)
- `is_a` — the type of the note
- Any other key becomes a property visible in the Inspector

## Body

Write in standard markdown: headings, lists, checkboxes, code blocks, bold, italic.

## Wikilinks

Type `[[` anywhere to search and link to another note:

```
See also [[What is Laputa]] for context.
```

Wikilinks create relationships between notes and power the graph view and backlinks panel.
