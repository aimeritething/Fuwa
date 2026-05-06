# Getting Started Vault

The Getting Started vault is a small public sample vault hosted at [refactoringhq/tolaria-getting-started](https://github.com/refactoringhq/tolaria-getting-started).

It exists to show Tolaria's conventions without requiring you to restructure your own notes first.

## What It Demonstrates

- Markdown notes with YAML frontmatter.
- Types such as Project, Person, Topic, and Procedure.
- Wikilinks in note bodies.
- Relationship fields in frontmatter.
- A local Git repository that can be connected to a remote later.
- Vault guidance files for AI agents.

## Local-Only By Default

When Tolaria clones the sample, it removes the remote from the local copy. This makes the sample vault disposable. You can edit it freely, commit locally, and delete it later.

To connect a vault to your own remote, use the bottom status bar remote chip or run `Add Remote` from the command palette.

Tolaria also repairs starter-vault guidance files when needed. `AGENTS.md` is the canonical guidance file, `CLAUDE.md` is kept as a compatibility shim, and `GEMINI.md` is only created when you explicitly restore Gemini guidance.

## When To Move On

After you understand the sample, open your own vault. Tolaria does not require a special folder structure: a folder of Markdown files is enough to start.
