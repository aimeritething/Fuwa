---
type: ADR
id: "0174"
title: "Lazy full Phosphor icon catalog"
status: active
date: 2026-08-06
supersedes: "ADR-0049 eager icon-registry growth consequence"
---

## Context

ADR-0049 made Phosphor names part of the durable `_icon` value contract and
noted that a substantially larger registry should move away from eager loading.
The original registry hand-selected 287 icons. Enumerating the package root
exposes all 1,530 unique public icon names, but also makes every SVG component
reachable from the startup chunk. In the measured production build that grew
the main App chunk from about 3.87 MB to 7.78 MB and its gzip size from about
1.04 MB to 1.83 MB. Rendering all 1,530 picker buttons at once also adds work
before the user has searched or scrolled.

## Decision

The registry derives canonical icon names from the installed Phosphor CSR
module filenames with Vite `import.meta.glob`. Each catalog entry wraps one
per-icon dynamic import. Compatibility-only root aliases map explicitly to
their canonical module and export, preserving the complete 1,530-name public
catalog without duplicate `Icon` twins.

`findIcon`, `resolveIcon`, `ICON_OPTIONS`, and their stored kebab-case values
remain synchronous. The returned component renders `FileText` while its local
icon module resolves. The type customization grid presents entries in batches
of 120 and extends the visible batch near the scroll boundary; filtering still
searches the entire catalog before applying the visible limit.

## Consequences

- Existing `_icon` values remain compatible and uncommon Phosphor names become
  selectable without editing a curated registry.
- Startup no longer imports every icon. The measured App chunk is about 3.26 MB
  (870 KB gzip), smaller than the pre-feature eager curated build.
- The distribution contains additional small icon chunks, but a normal note
  surface loads only the modules for icons it renders.
- Adding or upgrading Phosphor automatically refreshes canonical module names;
  compatibility aliases remain an explicit, tested map because they are not
  represented by module filenames.
- If the package changes its CSR export layout, the exact-count and resolver
  tests fail closed before release.
