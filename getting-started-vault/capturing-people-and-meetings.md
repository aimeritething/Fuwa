---
title: Capturing People and Meetings
is_a: Note
related_to: "[[Personal Knowledge Management]]"
author: "[[Luca Rossi]]"
date: 2025-01-28
---

The Person type is one of the most useful in my vault. Here's how I use it.

## One note per person

Every person I interact with meaningfully gets a Person note. Not just colleagues — also people I meet at conferences, authors whose work I follow, collaborators I might reach out to.

A minimal Person note looks like this:

```yaml
---
title: Matteo Cellini
is_a: Person
role: Head of Partnerships
related_to: "[[Refactoring Newsletter]]"
---
```

The body holds context: how we met, what they're working on, anything I want to remember.

## Meetings as connections

When I have a meeting, I create a note for it and link everyone present via `related_to`. This means every Person note accumulates backlinks over time — a natural history of interactions without any manual effort.

## Finding things later

The power comes when you need to remember something. Open a person's note, look at their backlinks — you see every meeting, every shared project, every note that mentioned them. It's the closest thing I've found to having a good memory.

## The pattern

Person notes are intentionally sparse upfront. I add context as I interact with people. A note that starts as just a name and a role grows into something genuinely useful over months.
