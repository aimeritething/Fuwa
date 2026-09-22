# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This is a **single-context** repo: one `CONTEXT.md` at the root and one `docs/adr/` directory. There is no `CONTEXT-MAP.md`.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root: the Plumo glossary. It records the product's terms (Document, Folder, Attachment, Image file, Session, Tab, …), the synonyms to avoid, and the code names (`note` for Document, `vault` for Folder).
- **`docs/adr/`**: read ADRs that touch the area you're about to work in. Each records one design choice, the alternatives rejected, and the consequences; the numbering starts at 0002.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0002-a-document-opened-on-its-own-uses-its-directory-as-the-boundary-root.md
│   └── …
└── src/
```

If the repo ever splits into several bounded contexts, switch to the multi-context layout: a root `CONTEXT-MAP.md` pointing at one `CONTEXT.md` per context, with context-scoped decisions in `src/<context>/docs/adr/` and system-wide ones still in `docs/adr/`.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids. Code keeps its own names (`note`, `vault`) where `CONTEXT.md` says so; people and UI use the glossary term.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0004 (the Rust side owns the Session file), but worth reopening because…_
