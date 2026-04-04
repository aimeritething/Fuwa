---
title: Types, Properties and Relationships
is_a: Note
belongs_to: "[[Getting Started]]"
---

## Types

A **type** is a category for your notes — Person, Project, Topic, Book, or anything you invent. Each type gets its own icon, color, and section in the sidebar.

Create a type by adding a markdown file with `is_a: Type` in the frontmatter:

```yaml
---
title: Book
is_a: Type
_icon: BookOpen
_color: "#8b5cf6"
---
```

Then tag any note with `is_a: Book` to classify it as a book.

## Properties

Properties are any key-value pairs in the frontmatter:

```yaml
rating: 4
status: Active
url: https://example.com
```

They appear in the **Inspector** panel on the right. Click "+ Add property" to add one.

## Relationships

Relationships are properties whose values are wikilinks to other notes:

```yaml
belongs_to: "[[Some Project]]"
related_to:
  - "[[Note A]]"
  - "[[Note B]]"
```

Standard relationships: `belongs_to`, `related_to`, `has`. You can define your own.
