---
title: Why Plain Files
is_a: Note
related_to: "[[Personal Knowledge Management]]"
author: "[[Luca Rossi]]"
date: 2024-11-05
---

I've used Notion, Roam, Bear, and Obsidian at different points. I kept switching. Here's what I eventually decided and why.

## The problem with databases

Notion stores your knowledge in a proprietary database. It's great for collaboration and structured data, but your notes are not really yours — they live in Notion's servers, in Notion's format. Export is lossy and awkward.

## The problem with sync-only tools

Obsidian keeps your files local, which I respect. But the sync story is fragile, and the plugin ecosystem means your setup is fragile too. I've lost time to broken plugins more than once.

## What I wanted

- Files I own, in a format that will be readable in 20 years
- Version history that actually works (not "version history" as a feature — real Git history)
- The ability to use AI to operate on my vault, which requires the AI to be able to read and write files

Markdown + Git gives me all three.

## Laputa's bet

Laputa is built on the same bet: your notes are files, your vault is a Git repo, and the app is just a great interface on top of that. If Laputa disappears tomorrow, your notes are still there, still readable, still version-controlled.

That's the kind of tool I wanted to build — and use.
