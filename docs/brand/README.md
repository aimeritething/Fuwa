# Brand

The quill mark: a 45° shaft with three horizontal barbs on a 64 × 64 grid, stroke 5,
round caps. Use it in one colour, no gradient, no outline; keep at least 8 grid units
clear on every side.

- `plumo-mark.svg` — ink (#1b1b1b), for light grounds.
- `plumo-mark-white.svg` — white, for dark grounds.
- `../../src-tauri/app-icon.svg` — the macOS app icon; `pnpm tauri icon src-tauri/app-icon.svg`
  regenerates `src-tauri/icons/`.
- `social-preview.html` — the GitHub social preview card (1280 × 640). Render it with
  `pnpm exec playwright screenshot --viewport-size=1280,640 docs/brand/social-preview.html out.png`
  and upload the PNG under the repository's Settings → Social preview.
