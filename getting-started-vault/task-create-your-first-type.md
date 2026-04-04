---
title: "Task: Create Your First Type"
type: Task
Status: Open
Belongs to: "[[Laputa Onboarding]]"
---

Types give structure to your vault. Every note has a type — Project, Person, Topic, or any custom type you define.

## What to try

1. Create a new markdown file (Cmd+N)
2. In the frontmatter, set `type: Type`
3. Add an `icon:` field — use any [Phosphor icon](https://phosphoricons.com) name in kebab-case (e.g. `book-open`, `lightning`, `house`)
4. Add a `color:` field — available colors: red, purple, blue, green, yellow, orange
5. Give it a title with a `# Heading` and a short description in the body
6. Save the file — your new type appears in the sidebar

## Example

```yaml
---
type: Type
icon: book-open
color: red
order: 6
---
```

The `order` field controls position in the sidebar (lower = higher).
