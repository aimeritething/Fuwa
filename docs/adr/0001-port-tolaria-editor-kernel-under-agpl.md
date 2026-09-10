---
status: accepted
date: 2026-09-10
---

# Port Tolaria's editor kernel verbatim and license Fuwa as AGPL-3.0

Fuwa's editing kernel (BlockNote rich mode, CodeMirror raw mode, the Markdown-to-blocks pipeline, mode switching with caret mapping, debounced disk-first autosave, and the durable-Markdown bridges for math, Mermaid, callouts, highlights, HTML blocks, tldraw, and shiki code blocks) is copied from [Tolaria](https://github.com/refactoringhq/tolaria) rather than re-implemented. Tolaria is AGPL-3.0-or-later, so Fuwa is AGPL-3.0-or-later as well. The alternative, a clean-room rewrite that follows only the architecture, would have freed the license choice but cost far more than the roughly 4.5k-line kernel plus block bridges it replaces, for a project whose whole point is to stay small.

## Consequences

- Any distribution of Fuwa must ship under AGPL-3.0-or-later and keep Tolaria's copyright notices on ported files.
- Ported files may be trimmed (vault, git, i18n, telemetry, analytics coupling removed) but should keep their structure so upstream fixes stay easy to compare.
- Features Tolaria treats as vault semantics (wikilinks, frontmatter properties, types) are not ported; see the project's Out of scope list.
