# Build baseline

Measured on 2026-09-10 at commit `2547fe36` plus the AIM-378 working tree (the
commit that adds this file), on macOS (Darwin 25.4.0, Apple Silicon), node
22.22.1, pnpm 10.33.2, rustc 1.94.0, Vite 7.3.5, Tauri CLI 2.11.x. Sizes are
Vite's own figures (kB = 1000 bytes); the binary and `.app` are from `ls -l`
and `du -sk`. No threshold is attached to any number (spec section 8, item 11;
[AIM-378](https://linear.app/aimerite/issue/AIM-378)).

## Shipped build

`pnpm tauri build` (which runs `pnpm build` = `tsc -b && vite build`, then a
release `cargo build` and the `.app` bundle).

| Number | Value |
| -- | -- |
| JS total | 303.59 kB (1 chunk) |
| JS gzip total | 96.83 kB |
| Largest chunks | `index-*.js` 303.59 kB / 96.83 kB gzip. There is no second chunk. |
| CSS | `index-*.css` 93.94 kB / 19.60 kB gzip |
| Fonts | 9 `.woff2` files (Inter and JetBrains Mono subsets), 276 kB |
| Release binary `src-tauri/target/release/fuwa` | 10,240,096 bytes (9.8 MB) |
| `Fuwa.app` | 10,024 KiB on disk (`du -sk`), 9.8 MB |
| Release `cargo build` | 1 min 01 s cold |

**Read this with care.** At this commit `App.tsx` renders an empty surface, so
the production graph reaches only `main.tsx`, the theme helpers, the fonts,
`index.css` and the mock-Tauri module. None of the editor kernel (BlockNote,
CodeMirror, KaTeX, Mermaid, shiki, tldraw) is imported from the entry yet.
The 303 kB is the shell, not the kernel. The next `tauri build` after the
editor shell lands (AIM-379) is the first number that reflects the app.

## Shipped build after the editor shell (AIM-379)

`pnpm build` on 2026-09-10 with the AIM-379 working tree, same machine and
toolchain (Vite 7.3.6). The first number that reflects the app: `App.tsx` now
mounts the editor shell, so the production graph reaches the whole kernel.

| Number | Value |
| -- | -- |
| JS total | 11,705.93 kB (139 chunks) |
| JS gzip total | 2,744.82 kB |
| Largest chunks | `index-*.js` 2,619.23 kB / 790.77 kB gzip · `TldrawWhiteboard-*.js` 1,325.10 kB / 411.24 kB · `cpp-*.js` (shiki grammar) 829.05 kB / 62.56 kB · `cynefin-*.js` (Mermaid) 691.42 kB / 155.09 kB · `mermaid.core-*.js` 672.97 kB / 163.53 kB |
| CSS | `index-*.css` 161.21 kB / 34.33 kB gzip |

tldraw and Mermaid are lazy chunks as ADR-0001 requires; KaTeX is inside
`index-*.js` (static import, by the spec's rule). The binary and `.app` were not
rebuilt for this entry.

## Kernel measurement (not shipped)

To give the post-v0.1 chunking decision a number now, a one-off `vite build`
was run from a scratch entry that eagerly imports every module under `src/`
except tests, the parser worker, `main.tsx`, `App.tsx` and
`TldrawWhiteboard.tsx` (left to the schema's `lazy()` import so tldraw stays
the lazy chunk it is in the app), with `manualChunks` placing `katex` in its
own chunk so its size is visible. This is an upper bound: it wires in modules
the shell may never mount together, and everything Tolaria loads lazily
through `import()` still lands in its own chunk here.

| Number | Value |
| -- | -- |
| JS total | 12,977 kB across 141 chunks |
| JS gzip total | 3,140 kB |
| Static initial payload | `kernel-*.js` 3,607.8 kB / 1,103.5 kB gzip + `katex-*.js` 261.3 kB / 77.57 kB gzip = 3,869.2 kB / 1,181.0 kB gzip |

Five largest chunks:

| Chunk | Raw | Gzip | Loaded |
| -- | -- | -- | -- |
| `kernel-*.js` (BlockNote, TipTap, ProseMirror, CodeMirror, React, the kernel) | 3,607.8 kB | 1,103.5 kB | statically |
| `TldrawWhiteboard-*.js` (tldraw) | 1,318.8 kB | 409.36 kB | lazily, first whiteboard block |
| `cpp-*.js` (shiki C++ grammar) | 829.1 kB | 62.58 kB | lazily, first C++ code block |
| `cynefin-*.js` (Mermaid diagram) | 691.4 kB | 155.09 kB | lazily, first Mermaid block of that kind |
| `mermaid.core-*.js` | 672.9 kB | 163.50 kB | lazily, first Mermaid block |

**KaTeX share.** As a static import KaTeX is 261.3 kB raw / 77.57 kB
gzip of JS: 6.8% raw / 6.6% gzip of the static initial payload, and
2.0% raw / 2.5% gzip of all JS. Its stylesheet and fonts are not
counted here. KaTeX stays a static import in v0.1 (ADR-0001); splitting it is
a post-v0.1 decision and this is the number to weigh it against.

## Repeating the measurement

Shipped build: `pnpm tauri build`, read the `dist/assets` table Vite prints,
then `ls -l src-tauri/target/release/fuwa` and
`du -sk src-tauri/target/release/bundle/macos/Fuwa.app`.

Kernel measurement: in a scratch folder inside the repo, an entry file with

```ts
import.meta.glob([
  '/src/**/*.{ts,tsx}', '!/src/**/*.test.*', '!/src/**/*.worker.ts',
  '!/src/test/**', '!/src/main.tsx', '!/src/App.tsx', '!/src/components/TldrawWhiteboard.tsx',
], { eager: true })
```

and a config that copies `vite.config.ts` (root, plugins, alias, target,
minify) with `build.rollupOptions.input` set to that entry and
`output.manualChunks(id)` returning `'katex'` for ids under
`/node_modules/katex/`. Run `pnpm exec vite build --config <that file>` and
delete the folder afterwards.
