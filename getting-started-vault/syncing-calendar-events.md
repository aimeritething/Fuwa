---
title: Syncing Calendar Events into Laputa
is_a: Note
related_to: "[[Personal Knowledge Management]]"
author: "[[Luca Rossi]]"
date: 2025-02-10
---

One pattern I've found genuinely useful: every significant meeting or event gets a note in my vault.

## How it works

My AI assistant Brian runs a cron job that checks my calendar daily. For each meeting, it creates (or updates) an Event note in my vault with the relevant metadata — title, date, attendees — and links each attendee to their Person note.

The result: every person I meet has a trail of events in their backlinks. I can open [[Luca Rossi]]'s note and immediately see every meeting we've had, what was discussed, what followed.

## What an Event note looks like

```yaml
---
title: 1:1 with Matteo — Jan 10
is_a: Event
date: 2025-01-10
related_to:
  - "[[Matteo Cellini]]"
  - "[[Refactoring Newsletter]]"
---
```

The body holds notes from the meeting — decisions, action items, context.

## Why this matters

Without this, meetings exist only in my calendar and my memory. With it, they become searchable, connected knowledge. A year later I can search "Matteo sponsorship" and find the exact conversation where we made a decision.

You don't need a cron job to do this — you can create Event notes manually. The pattern is what matters.
