# Linear app tokens (the real ones), read from the Linear app's client bundle

Companion to `Linear_DESIGN.md`, which describes the **marketing site**. This file records what the
**Linear app itself** uses, because the editor style catalog
is rendered with these values, not the marketing ones. Extracted 2026-09-10 from `static.linear.app/client/assets/`
(`style-H1ZQGW6c.css`, `darkThemeRefresh`, `lightThemeRefresh`, `ThemeProvider`) by running Linear's own
`generateTheme` in Node. Method: the app generates every colour at runtime from an LCH base colour, an LCH
accent, and a contrast number; the numbers below are the RGB output of that generator for the two default
themes.

## Live verification (2026-09-10, the catalog document open in Chrome, default dark theme)

Read with `getComputedStyle` on the real page. The generator output above matches the live `--sx-*`
variables exactly (`bgSub #09090a`, `bgBase #111212`, `labelBase #e2e3e5`, `labelLink #6f7ffe`,
`controlPrimary #5e69d1`). Things only the live page showed:

| Element | Live value |
|---|---|
| Window canvas (`html`) | `#09090a`; sidebar is transparent over it, 236px wide, items 13px / 500 in `#919294` |
| Content card (`main`) | `#111212`, radius 12px, shadow `0 0.5px 1px 1px rgba(0,0,0,.3)`, 8px inset from the canvas |
| Editor column | padding `10px 14px`, text column ~805px wide in a 1322px window (documents are wide, not a 680px measure) |
| Body `p` | 15px / 24px, weight 450, letter-spacing −0.1px, `labelBase` |
| h1 / h2 / h3 / h4 | 22/29.6 · 19/28 · 17/24 · 15/24, all 600, `#ffffff`; h5/h6 14px, also white on this build |
| strong | 600, `#ffffff` |
| **Links inside the editor** | `#adbbff` (lighter than `labelLink #6f7ffe`, which is the UI link colour); no underline, underline on hover |
| Inline code | bg `rgba(255,255,255,.075)`, inset 0.5px border ≈ `#3f4042`, radius 0.2em, font 0.9375em, text colour inherits |
| Code block | bg `#09090a`, 0.5px border ≈ `#2c2d2f`, radius 6px, code 13.1px / 18.4px, padding 16px |
| Blockquote | 4px bar ≈ `#27282a`, padding-left 16px, text colour unchanged |
| hr | 1px `#27282b` |
| Table | bg `#111212`, 0.5px borders `#2c2d2f`, radius 6px, header row `#161617` at weight 450 |
| Checkbox | 14px, 1px border ≈ `#565658`, checked fills with `labelBase` |
| Callout | accent `#26b5ce` at 2% bg / 20% border |
| Selection | `color-mix(labelMuted 20%, transparent)` |
| Code highlight | keyword `#e394dc`, string `#00c5f0`, title `#25f8ca`, attr `#fce27d`, literal `#ec3b40`, comment `#565759` (= labelFaint) |

### Interactive states (live, dark default)

Read from the app's own `--sx-*` variables on the root and from computed styles with the state active.

| State | Value |
|---|---|
| Sidebar row | 28px tall, radius 8px, 13px / 500, text `#919294`, transparent |
| Sidebar row hover | bg `#1d1e1f` (`sidebarLinkBg`), text `#ffffff` |
| Sidebar row active | bg `#28292b` (`sidebarLinkBgActive`) |
| Icon button | 28×28, radius 9999px, transparent, icon `#e2e3e5` |
| Icon button hover | bg `#232324` (`controlTertiaryHover`), icon `#ffffff` |
| Icon button pressed / open | bg `#2c2d2e` (`controlSecondarySelected`) |
| Secondary button (e.g. "New issue") | bg `#1b1b1c` (`controlSecondary`), hover `#242526` |
| Primary button | bg `#5e69d1`, hover `#6974e1`, label `#fefeff`, radius 4px |
| Base surface hover | `#191a1b` (`bgBaseHover`); shade hover `#171719`; selected hover `#1f223e` |
| Text hover | title `#d6d6d6`, base `#bfc0c2`, muted `#ababad` |
| Border hover | `#27282a`; solid hover `#303133` |
| Menu panel | bg `#202022` (menu sub-theme), 0.5px border `#323336`, radius 12px, shadow `0 3px 8px #0000001f, 0 2px 5px #0000001f`, 264px wide, no padding |
| Menu item | 32px tall, padding `0 18px 0 14px`, 13px / 450, text `#e4e5e8`; shortcut 11px / 500 in `#9c9d9f`, Inter not mono; separators 0.5px |
| Menu item hover | inner pill 250px wide, radius 8px, bg ≈ `#303133`, text `#ffffff` |
| Tooltip | same surface as menu: bg `#202022`, 0.5px border `#323336`, radius 8px, shadow `0 0.5px 1px 1px rgba(0,0,0,.3)`, padding 5px 8px, 11px / 450 label, kbd chips 11px / 400 in `#9c9d9f` |
| Input | bg `#111212`, 1px border `#232325`, radius 8px, 13px, padding 6px 12px |
| Focus ring | `0 0 0 1px #5e69d1` |
| Selection | `labelMuted` at 20% |
| Overlay | `#00000066` |
| Chrome tabs (desktop app) | bg `#1a1b1e`, hover `#1e1f22`, active `#232427` |
| Scrollbar | `#575759` |

Hover colour scale of the chromatic set (`*Text` variants are the readable-on-dark forms): teal `#00b8cb` / text `#00e8ff`, green `#26a544` / `#3de261`, yellow `#f0bf00` / `#edbf0a`, orange `#ff7235` / `#ff9958`, red `#f34e52` / `#ff8583`, blue `#55ccff` / `#00ceff`, purple `#5e6ad2` / `#adbaff` (the editor link `#adbbff` is `purpleText`).

## Where the marketing sheet and the app disagree

| Topic | `Linear_DESIGN.md` (marketing) | Linear app |
|---|---|---|
| Body text (dark) | Mist `#d0d6e0` | `#e2e3e5` (≈ Bone) |
| Body weight | 400 | **450** (Inter Variable) |
| Heading weight | 510 / 590, cap at 590 | **600** (semibold), title 500 |
| Font features | `cv01`, `ss03`, `zero` | none globally; headings `calt`; tabular `tnum` for numbers only |
| Mono font | Berkeley Mono | Berkeley Mono, falling back to `SFMono Regular`, Consolas, Menlo |
| Editor body size | 16px / 1.5 | **15px / 1.6**, letter-spacing −0.0067em |
| Accent | acid lime `#e4f222` (one CTA) | indigo `#5e69d1` (buttons, focus, selection); no lime anywhere in-app |
| Hairline | 0.5px | 0.5px on HiDPI, 1px otherwise (`thinPixel`) |
| Popover surface | – | its own generated sub-theme, ~8 L-steps above base |

## Theme generator inputs

| Theme | base LCH | accent LCH | contrast |
|---|---|---|---|
| Dark (default) | `5.52 0.4 272` | `47.92 59.30 288.42` | 27 |
| Light (default) | `97.94 0.5 282` | `53 52.26 286.91` | 30 |
| Dark, high contrast | `8 0.75 272` | same | 90 |
| Light, high contrast | `98.7 0.5 282.86` | same | 90 |

## Colours, dark default

Base theme (the document/editor area):

| Token | Value | Role |
|---|---|---|
| bgSub | `#09090a` | sidebar canvas, code block background |
| bgBase | `#111212` | main content surface, editor surface |
| bgShade | `#151617` | table header, subtle fills |
| bgSelected | `#1b1e37` | selected row (indigo tint) |
| bgFocus | `#222223` | focused row |
| bgBorder | `#232325` | default border, hairline colour |
| bgBorderFaint | `#1a1b1d` | faint dividers |
| bgBorderSolid | `#27282a` | blockquote bar, hr |
| bgBorderStrong | `#727376` | strong outlines |
| labelTitle | `#ffffff` | headings, titles |
| labelBase | `#e2e3e5` | body text |
| labelMuted | `#949597` | secondary text, h5/h6 |
| labelFaint | `#565658` | placeholders, checkbox border, comments in code |
| labelLink | `#6f7ffe` | links |
| controlPrimary | `#5e69d1` | primary button, focus ring, table selection |
| controlPrimaryLabel | `#fefeff` | text on primary |
| controlSecondary | `#1b1b1c` | secondary button |
| controlSecondarySelected | `#2c2d2e` | pressed secondary |
| bgModalOverlay | `#00000066` | dialog scrim |

Sub-themes (each is a full palette; the important slots):

| Sub-theme | bgBase | bgShade | bgSelected | bgBorder | labelBase | labelMuted | labelFaint |
|---|---|---|---|---|---|---|---|
| sidebar | `#09090a` | `#0e0f10` | `#161935` | `#1d1d1f` | `#e2e2e5` | `#919294` | `#515254` |
| elevated (dialogs) | `#19191b` | `#1c1d1f` | `#21233a` | `#2a2b2e` | `#e3e4e7` | `#98999b` | `#5c5c5f` |
| menu (popovers) | `#202022` | `#242426` | – | `#323336` | `#e4e5e8` | – | – |

Chromatic: blue `#55ccff`, green `#26a544`, red `#f34e52`, yellow `#f0bf00`, orange `#ff7235`,
teal `#00b8cb`, purple `#5e6ad2`. Callout default accent `#26b5ce`.

Shadows: low `0 0.5px 1px 1px #0000004c`; medium `0 3px 8px #0000001f, 0 2px 5px #0000001f, 0 1px 1px #0000001f`;
high `0 4px 40px #00000019, 0 3px 20px #0000001f, 0 3px 12px #0000001f, 0 2px 8px #0000001f, 0 1px 1px #0000001f`;
border `0 0 0 0.5px #232325`; focus `0 0 0 1px #5e69d1`.

## Colours, light default

| Token | Value |
|---|---|
| bgSub | `#eeeeef` |
| bgBase | `#f8f8f9` |
| bgShade | `#e9e9ea` |
| bgSelected | `#e7e8f3` |
| bgFocus | `#eaeaeb` |
| bgBorder | `#dedede` |
| bgBorderFaint | `#f1f1f1` |
| bgBorderSolid | `#d2d2d2` |
| bgBorderStrong | `#7c7c7c` |
| labelTitle | `#1b1b1b` |
| labelBase | `#2f2f31` |
| labelMuted | `#5b5c5e` |
| labelFaint | `#9c9c9e` |
| labelLink | `#3f60d9` |
| controlPrimary | `#6d78d5` |
| controlSecondary | `#fefeff` |
| controlSecondarySelected | `#f0f0f0` |
| bgModalOverlay | `#0000003f` |

| Sub-theme | bgBase | bgShade | bgSelected | bgBorder | labelBase | labelMuted | labelFaint |
|---|---|---|---|---|---|---|---|
| sidebar | `#eeeeef` | `#dfdfe0` | `#dedfeb` | `#d4d4d4` | `#2d2d2f` | `#58585a` | `#969698` |
| elevated / menu | `#ffffff` | `#efefef` | `#ededf8` | `#e3e3e3` | `#303031` | `#5e5e5f` | `#a0a0a2` |

Green in light is `#43bc58`; the other chromatic values are shared with dark.

Shadows: low `0 3px 6px -2px #00000005, 0 1px 1px #0000000a`; medium `0 6px 18px #00000005, 0 3px 9px #0000000a, 0 1px 1px #0000000a`;
high `0 9px 48px #00000014, 0 6px 24px #00000019, 0 1px 1px #0000000a`; border `0 0 0 0.5px #dedede`; focus `0 0 0 1px #6d78d5`.

## Typography (root 16px)

Fonts: `--font-regular: "Inter Variable", "SF Pro Display", -apple-system, …`;
`--font-monospace: "Berkeley Mono", "SFMono Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace`.
Weights: light 300, normal **450**, medium 500, semibold 600, bold 700.

UI sizes: micro 11px, mini 12px, small 13px, regular 15px, large 18px, title3 20px, title2 24px, title1 36px.
Inputs: 13px, padding 6px 12px, radius 8px, 1px border in bgBorder. Control radius 4px. Rounded 9999px.

Editor (`.editor`):

| Element | Size / line-height | Weight | Colour | Spacing |
|---|---|---|---|---|
| body | 15px / 1.6, letter-spacing −0.0067em | 450 | labelBase | 16px between paragraphs |
| h1 | 22px / 29.6px, ls −0.07px | 600 | labelTitle | top 48px, bottom 16px |
| h2 | 19px / 28px, ls +0.05px | 600 | labelTitle | top 32px, bottom 16px |
| h3 | 17px / 24px, ls +0.1px | 600 | labelTitle | top 24px, bottom 6px |
| h4 | 15px / 24px | 600 | labelTitle | top 22px, bottom 6px |
| h5, h6 | 14px | 600 | labelMuted | top 22px, bottom 6px |
| strong | – | 600 | inherit | – |
| inline code | 0.9375em (14px) / 1.3, mono | – | inherit; bg `inline-code-background`, hairline inset border, radius 0.2em, padding 0 0.25em | – |
| code block | 0.875em (13px) / 1.4, mono | – | bg bgSub, hairline border bgBorderThin, radius 6px, padding 16px | 22px above |
| blockquote | inherit | – | 4px bar (radius 2px) in bgBorderSolid, padding-left 16px | – |
| hr | 1px | – | bgBorderSolid | 22px margin |
| table | inherit | – | hairline bgBorderThin, radius 6px, header row bgShade, cells on bgBase | – |
| list | inset 24px, disc 0.5em | – | marker inherits | 6px after a paragraph |
| checkbox | 14px, radius 3px | – | 1px labelFaint border; checked = filled with text colour at 90% | – |
| link | inherit | – | labelLink, no underline, underline on hover (offset 2px, 1px) | – |
| callout | inherit | – | accent `#26b5ce`; bg accent at 2%, border accent at 20%, hairline, radius 6px | – |
| selection | – | – | labelMuted at 20%; active focusColor at 40% | – |

Block spacing scale: `--editor-block-spacing` 16px, large 22px (×1.375), small 6px (×0.375).
Editor block radius 6px. Content column: StyleX classes at 664/672/680/704/720px exist; the document
body sits in that band (the shell prototype's 680px is inside it).
