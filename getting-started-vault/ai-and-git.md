---
title: AI and Git
is_a: Note
belongs_to: "[[Getting Started]]"
---

## Claude Code

Laputa integrates with [Claude Code](https://docs.anthropic.com/claude-code) — Anthropic's CLI agent. If you have `claude` installed, you can ask it to operate directly on your vault:

```
claude "Create a note for the book Zero to One by Peter Thiel, with a rating and a topic"
```

Claude understands Laputa's format (frontmatter, types, wikilinks, relationships) and creates or edits files accordingly. Your vault's `AGENTS.md` file gives any coding agent full context, and `CLAUDE.md` imports it for Claude Code compatibility.

## Git sync

Your vault is a Git repository. Every save in Laputa is tracked as a file change. Use the **Changes** view in the sidebar to see what's modified, commit with a message, and push to a remote.

```bash
# From inside your vault folder
git remote add origin https://github.com/you/my-vault.git
git push -u origin main
```

After that, Laputa can push and pull directly from the app.
