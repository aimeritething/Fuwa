---
status: accepted
date: 2026-09-10
amended: 2026-09-10 (port depth, AIM-372; repo baseline, AIM-370)
---

# Port Tolaria's editor kernel verbatim and license Fuwa as AGPL-3.0

Fuwa's editing kernel (BlockNote rich mode, CodeMirror raw mode, the Markdown-to-blocks pipeline, mode switching with caret mapping, debounced disk-first autosave, and the durable-Markdown bridges for math, Mermaid, callouts, highlights, HTML blocks, tldraw, and shiki code blocks) is copied from [Tolaria](https://github.com/refactoringhq/tolaria) rather than re-implemented. Tolaria is AGPL-3.0-or-later, so Fuwa is AGPL-3.0-or-later as well. The alternative, a clean-room rewrite that follows only the architecture, would have freed the license choice but cost far more than the kernel it replaces, for a project whose whole point is to stay small.

## Port depth (amendment)

The charting estimate of a "roughly 4.5k-line kernel" was wrong by about nine times. The kernel port inventory ([AIM-363](https://linear.app/aimerite/issue/AIM-363), branch `research/kernel-port-inventory`) measured the honest closure at about 40k LOC of frontend (~240 files), 3.1k LOC of Rust, and 22k LOC of tests worth carrying, plus 37 npm dependencies and six mandatory pnpm patches on BlockNote, TipTap and prosemirror-tables.

Knowing that, v0.1 still ports the **full surface verbatim and cuts only at feature seams** ([AIM-372](https://linear.app/aimerite/issue/AIM-372)). The alternative was to thin by depth: replace the ADR-0105/0109 parse pipeline with BlockNote's plain parser and drop the larger ProseMirror extensions, landing near 25k LOC. It was rejected because line count is the wrong cost measure for a verbatim port. Copied, tested, pure-TS files are nearly free; trimmed files are where bugs and upstream drift live. Tolaria's 74 extension files are correctness guards (IME composition, focus ownership, paste and render recovery, caret mapping) rather than power-user features, and the ones that look optional are woven into the side menu, the shell and the caret-mapping tests.

## Consequences

- Any distribution of Fuwa must ship under AGPL-3.0-or-later and keep Tolaria's copyright notices on ported files.
- Ported files may be trimmed (vault, git, i18n, telemetry, analytics coupling removed) but should keep their structure so upstream fixes stay easy to compare.
- Features Tolaria treats as vault semantics (wikilinks, frontmatter properties, types) are not ported; see the project's Out of scope list.
- The rule for every kernel group is copy verbatim, or copy and remove a whole feature Fuwa scoped out. No group is thinned by depth. Whole features removed: wikilinks (UI only; `utils/wikilinks.ts` stays as an inert text utility so `[[…]]` text round-trips losslessly), sheets, AI, inspector, vault expressions, title-based rename and the Rust wikilink rewriter, sandboxed-script HTML blocks and their custom protocol, remote-image paste, and all six optional Rust commands.
- The parse pipeline (worker-backed fast parser, progressive block mounting, generation-checked swaps, parsed-block LRU) is kept whole. The only Fuwa-authored piece there is a small event bus replacing Tolaria's note-content cache for the parsed-block preload.
- tldraw ships in v0.1 as the existing lazy chunk; Mermaid and the extra shiki grammars stay dynamic imports; KaTeX stays a static import until a measured bundle size says otherwise.
- The Editor shell (`Editor.tsx`, `EditorContentLayout`) is rewritten at about 600 LOC rather than copied; everything it mounts is copied.
- Stub modules (i18n, telemetry, analytics, mock-tauri, startup performance, app command dispatcher) keep Tolaria's module paths so the carried tests' `vi.mock` calls resolve. The ~110 carried test files plus the nine pnpm patch-guard tests are the reason verbatim copying is safe.
- Tolaria's app-level `index.css` and `theme.json` are copied verbatim and re-valued to Linear tokens in place; variable names are not renamed, because the kernel CSS and shadcn primitives reference them.
- The port is a file copy at Tolaria commit `ee768ac`, not a git-history merge; Tolaria is kept as the `upstream` remote so `git diff upstream/main -- <path>` and `git cherry-pick` stay native operations ([AIM-370](https://linear.app/aimerite/issue/AIM-370)). Ported files keep Tolaria's directory layout, and Fuwa-authored code lives in the same directories rather than a separate tree.
- Code keeps Tolaria's vocabulary: identifiers say `note` and `vault`, including in Fuwa-authored code, while product language, UI copy and docs say Document and Folder. Renaming across ~240 files would break every upstream comparison for no user-visible gain; `CONTEXT.md` records the mapping.
- Attribution is a root `NOTICE.md` (source commit, copyright holders, modification date) plus the license fields; no per-file headers, because Tolaria carries none and AGPL section 5 asks for notice on the work, not per file.
