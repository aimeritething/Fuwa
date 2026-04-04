---
title: "What is Laputa"
type: Note
Related to:
  - "[[Getting Started]]"
  - "[[Topic: Personal Knowledge Management]]"
---

Laputa is a local-first knowledge management app built on three principles:

## Your files, your data

Every note is a plain markdown file on your filesystem. There is no proprietary database, no cloud lock-in, no import/export ceremony. Your vault is a folder — you can open it in any text editor, back it up however you want, and it will outlive any app.

## The filesystem is the truth

Laputa reads your files and derives everything from them. Types, relationships, views, and sidebar sections are all computed from the frontmatter and folder structure. There is no hidden state. If you move a file in Finder, Laputa reflects the change. If you edit a file in VS Code, Laputa picks it up.

## Git for sync and history

Your vault is a git repository. Every change is a commit. Sync between devices by pushing and pulling to a remote. Resolve conflicts with standard git tools. Your entire edit history is preserved.

## How it fits together

A Laputa vault is a collection of markdown files with YAML frontmatter. The `type` field in the frontmatter determines what kind of entity the note represents. Wiki-links (`[[Note Title]]`) create a web of connections between notes. The app provides a visual interface on top of these files — a rich editor, sidebar navigation, inspector panel, and filtered views — but the files remain the source of truth.
