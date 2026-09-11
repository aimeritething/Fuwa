# Formatter 选型：Prettier、oxfmt、Biome 在 Fuwa 这套栈上的取舍

Linear [AIM-408](https://linear.app/aimerite/issue/AIM-408)。调研日期 2026-09-12。栈：Tauri v2 + React 19 + TypeScript 5.9 +
Vite 7，Tailwind v4（`@tailwindcss/vite`，`src/index.css` 以 `@import "tailwindcss"` 开头），10 个手写 CSS 文件共
3,463 行，ESLint 9 flat config 以 `--max-warnings=0` 运行，Rust 侧 `cargo fmt`，CI 在 macOS 上跑 `pnpm tsc`、
`pnpm lint`、`pnpm test`、`cargo clippy --all-targets`、`cargo test`。目前没有 formatter。

方法：所有结论来自各工具的官方文档、changelog、npm registry、GitHub issue（每条都附 URL），外加在
scratchpad 的一次性 `git worktree` 里对本仓库 HEAD（`83719003`）做的实测；实测只在临时 worktree 里写文件，
`main` 未被触碰。三个工具都是 2026-09-12 当天从 npm 拉的最新版：Prettier 3.9.6、oxfmt 0.67.0、
`@biomejs/biome` 2.5.13、`prettier-plugin-tailwindcss` 0.8.1。

## 摘要（5 行）

1. 三者都能格式化 `.css`：Prettier 和 oxfmt 对 Tailwind v4 at-rule 零配置通过；Biome 必须开
   `css.parser.tailwindDirectives`，否则 `src/index.css` 直接报 parse error（实测 3 处），且该 parser 仍在修 bug。
2. Tailwind class 排序只有两条可用路径：`prettier-plugin-tailwindcss`（官方，`tailwindStylesheet` 指向
   `src/index.css`）和 oxfmt 内置的 `sortTailwindcss`（同一算法、同一 vendored sorter）；Biome 的
   `useSortedClasses` 仍是 nursery + unsafe fix，不认 v4 的 `@theme`/`@utility`，实测把 `text-muted-foreground` 排错位置。
3. 现有 `eslint.config.js` 没有启用任何格式类规则，换哪个 formatter 都不需要改 ESLint；`eslint-config-prettier`
   在这套配置上只会关掉 `no-unexpected-multiline`。Biome 若接管 lint，会丢掉仓库明确依赖的
   `react-hooks/refs`、`set-state-in-effect` 等 React Compiler 规则——Biome 没有对应物。
4. 首次全量格式化实测（ts/tsx/css）：Prettier 默认配置 555 文件 +63,180/−46,415；改成 `semi:false, singleQuote,
   printWidth:100`（即代码现状）后 444 文件 +14,359/−8,475，oxfmt 同配置 454 文件 +14,783/−8,794。CSS 只占约 +440/−235。
5. oxfmt 仍是 0.x beta（每 1–2 周发版，`printWidth` 默认 100 与 Prettier 不同），但输出与 Prettier 字节级一致，
   并提供 `--migrate=prettier`，是将来可零成本切换的"加速器"，不是今天的首选。

**建议**：采用 **Prettier 3.9.x + prettier-plugin-tailwindcss 0.8.x**，配置 `semi: false`、`singleQuote: true`、
`printWidth: 100`、`tailwindStylesheet: ./src/index.css`、`tailwindFunctions: [cn, cva, clsx]`；首轮只覆盖
ts/tsx/css/json/yml，Markdown 先放进 `.prettierignore`（`docs/**/*.md` 一格式化就是 +6,475/−3,943，且本仓库的
Markdown 是产品域）。ESLint 配置不动，不装 `eslint-config-prettier`。首次格式化单独一个 commit，紧接一个
commit 加 `.git-blame-ignore-revs`。CI 在 ESLint 之后加 `pnpm format:check`（`prettier --check .`）。solo 仓库不加
pre-commit hook，靠编辑器 format-on-save + CI 兜底；oxfmt 稳定（1.0）后可用 `oxfmt --migrate=prettier` 换掉
Prettier 而不改风格。Biome 不推荐：格式输出有意与 Prettier 分歧、默认 tab 缩进、Tailwind 排序不成熟，而它最大的
卖点（一个工具包办 lint）在这里用不上。

## 1. 三个工具的成熟度、TS/TSX 与 CSS 覆盖

| | Prettier | oxfmt | Biome |
|--|--|--|--|
| 最新版（npm，2026-09-12） | 3.9.6（2026-07-21） | 0.67.0（2026-09-07） | 2.5.13（2026-09-10） |
| 状态 | 稳定；`main` 已是 3.10.0-dev，4.0 仍是 alpha | **beta**（2026-02-24 宣布），0.x，无 1.0 公告 | 稳定 |
| TS/TSX | `typescript` parser（typescript-estree 8.65） | "passes 100% of Prettier's JavaScript and TypeScript conformance tests" | TS 5.9 supported |
| 格式化 `.css` | 是（postcss） | 是（文档称 native Rust；实测输出与 Prettier 一致） | 是，默认开启，但 Tailwind v4 语法需开 `tailwindDirectives` |
| Tailwind v4 at-rule（`@theme`/`@custom-variant`/`@utility`/`@source`/`@apply`） | 零配置通过 | 零配置通过 | 不开选项 → parse error |
| 检查命令 | `prettier --check .` | `oxfmt --check` | `biome format`（不带 `--write`）/ `biome ci` |
| 配置文件 | `.prettierrc` 等 | `.oxfmtrc.json`/`.jsonc`、`oxfmt.config.ts` | `biome.json`/`biome.jsonc` |
| 本仓库 561 文件检查耗时（实测） | 2.5 s | 19 ms（进程 0.16 s） | 60 ms（进程 0.24 s） |

### Prettier 3.x

- `latest` = 3.9.6，发布 2026-07-21；`next` 是 4.0.0-alpha.13（2025-11-18，已停滞）。来源：
  <https://registry.npmjs.org/prettier>。发布节奏 3.9（2026-06-27）、3.8（2026-01-14）、3.7（2025-11-27）、
  3.6（2025-06-23）：<https://prettier.io/blog>。
- CSS 走 postcss 8.5.16 / postcss-scss / postcss-less；TS 走 `@typescript-eslint/typescript-estree` 8.65.0：
  <https://raw.githubusercontent.com/prettier/prettier/3.9.6/package.json>，parser 列表见
  <https://prettier.io/docs/options#parser>。
- Tailwind v4 at-rule：Prettier 的 postcss parser 把未知 at-rule 当通用节点处理。对 `@theme`、`@custom-variant`、
  `@utility`、`@source`、`@apply` 的 stdin 实测 exit 0，全部保留并正常缩进；在 prettier/prettier 的 issue tracker 搜
  `@theme`、`@custom-variant`、`@utility`、"tailwind v4" 无任何匹配。本仓库 10 个 CSS 文件用 Prettier `--write`
  后无错误，diff 只有 +559/−202（默认宽度 80）或 +438/−235（宽度 100），内容是 `font-family` 列表和
  `color-mix(...)` 换行、`#0969DA` → `#0969da` 之类。
- 与 oxfmt 相关的选项：`experimentalTernaries`（3.1 起）、`objectWrap`（3.5 起，默认 `"preserve"`）、
  `experimentalOperatorPosition`（3.5 起）：<https://raw.githubusercontent.com/prettier/prettier/main/docs/options.md>。
- 3.6 起有 `--experimental-cli`（"a new experimental high-performance CLI behind a feature flag"，
  <https://prettier.io/blog/2025/06/23/3.6.0>），3.9.6 的 `bin/prettier.cjs` 仍识别该 flag 与
  `PRETTIER_EXPERIMENTAL_CLI`，但 `docs/cli.md` 未收录，属非正式功能。
- `prettier --check`："The command will return exit code `1` in the second case"（有未格式化文件）：
  <https://raw.githubusercontent.com/prettier/prettier/3.9.6/docs/cli.md>。

### oxfmt（oxc formatter）

- npm `oxfmt` 0.67.0（2026-09-07），代码在 oxc monorepo 的 `npm/oxfmt`（不存在独立的 `oxc-project/oxfmt` 仓库），
  `engines.node: "^20.19.0 || >=22.12.0"`：<https://registry.npmjs.org/oxfmt/latest>。Changelog：
  <https://github.com/oxc-project/oxc/blob/main/npm/oxfmt/CHANGELOG.md>。
- 状态：2026-02-24 "We are excited to announce that Oxfmt has reached beta"，"We are continuing to improve Oxfmt
  towards a stable release"：<https://oxc.rs/blog/2026-02-24-oxfmt-beta.html>。VoidZero："To reach 1.0, a few more
  features like native Prettier plugin support ... are planned"：<https://voidzero.dev/posts/whats-new-feb-2026>。
  截至 2026-08 的月报仍无 1.0 公告；GitHub milestone "Oxfmt Q2"/"Oxfmt Q3" 仍开着：
  <https://github.com/oxc-project/oxc/milestone/19>、<https://github.com/oxc-project/oxc/milestone/23>。
- Prettier 兼容："Oxfmt matches Prettier's JavaScript formatting. When migrating from recent versions of Prettier,
  formatting differences should not occur; any formatting differences are considered bugs."、"Oxfmt now passes 100%
  of Prettier's JavaScript and TypeScript conformance tests."：<https://oxc.rs/docs/guide/usage/formatter.html>。
  "Oxfmt's output is closest to Prettier v3.8."：<https://oxc.rs/docs/guide/usage/formatter/migrate-from-prettier.html>。
- 与 Prettier 的默认差异：`printWidth` 默认 **100**（Prettier 80）；不支持 `experimentalTernaries`、`package.json`
  里的 `prettier` 字段、Prettier 插件（tailwindcss/packagejson/jsdoc 有内置替代）：
  <https://oxc.rs/docs/guide/usage/formatter/unsupported-features.html>。`objectWrap`、`experimentalOperatorPosition`
  支持：<https://oxc.rs/docs/guide/usage/formatter/config-file-reference.html>。
- 文件类型：native（Rust）——JS/JSX、TS/TSX、JSON/JSONC/JSON5、**CSS/SCSS/Less（`.css .scss .less .pcss .postcss`）**、
  GraphQL、TOML、YAML；Prettier-backed（bundled）——HTML、Angular、Vue、Svelte、Markdown、MDX、Handlebars、MJML。
  "The rest are delegated to a bundled Prettier ... No separate `prettier` install is required."、"These formats
  require Node.js and are only available with the `oxfmt` npm package."：
  <https://oxc.rs/docs/guide/usage/formatter/language-support.html>。本地核实：`node_modules/oxfmt/dist/` 里有
  `prettier-*.js`、`postcss-*.js`（源自 `prettier@3.9.6/plugins/postcss.mjs`）、`markdown-*.js`、`yaml-*.js`，
  唯一运行时依赖 `tinypool`。
- 实测：对本仓库 CSS 的输出与 Prettier 同宽度下逐字节相同（+438/−235）。注意 **不带路径的 `oxfmt` 会格式化整个
  目录并默认写盘**（"formats the current directory (equivalent to `prettier --write .`)"，
  <https://oxc.rs/docs/guide/usage/formatter/quickstart.html>），实测会一并改掉 `AGENTS.md`、`docs/**/*.md`、
  `package.json`、`src/shared/appCommandManifest.json`——需要 `ignorePatterns`。
- CLI：`--write`（默认）、`--check`（"Check if files are formatted, also show statistics"）、`--list-different`、
  `--migrate=prettier|biome`、`--lsp`：<https://oxc.rs/docs/guide/usage/formatter/cli.html>。配置文件
  `.oxfmtrc.json`/`.oxfmtrc.jsonc`/`oxfmt.config.ts`，默认读 `.gitignore` 与 `.prettierignore`，识别
  `// prettier-ignore`：<https://oxc.rs/docs/guide/usage/formatter/config.html>。编辑器：VS Code 扩展
  `oxc.oxc-vscode` 可作 `editor.defaultFormatter`，"Editor extensions use `oxfmt --lsp` from your project, so
  `oxfmt` must be installed locally"：<https://oxc.rs/docs/guide/usage/formatter/editors.html>。

### Biome 2.x

- `@biomejs/biome` 2.5.13（2026-09-10）：<https://registry.npmjs.org/@biomejs/biome/latest>。语言支持页：TS "Version
  5.9 supported"，JS/TS/JSX/TSX/JSON/JSONC/CSS/GraphQL 全部 parse+format+lint，SCSS 进行中：
  <https://biomejs.dev/internals/language-support/>。
- CSS formatter 自 1.9 起默认开启："Biome's CSS formatter and linter are now considered stable and are enabled by
  default"：<https://biomejs.dev/blog/biome-v1-9/>。（配置参考页仍写 `css.formatter.enabled` 默认 false，属文档过期；
  实测无配置即格式化 CSS。）CSS 默认 **tab 缩进**、`lineWidth` 80、双引号：<https://biomejs.dev/reference/configuration/>。
- Tailwind v4：选项 `css.parser.tailwindDirectives`（默认 false），"Enables parsing of Tailwind CSS 4.0 directives and
  functions"，2.3.0 加入（PR #7164），另有 CLI flag `--css-parse-tailwind-directives=true`：
  <https://biomejs.dev/reference/configuration/>、
  <https://github.com/biomejs/biome/blob/main/packages/@biomejs/biome/CHANGELOG.md>。实测不开该选项时
  `src/index.css:4:2`、`455:2`、`505:6` 报 "Tailwind-specific syntax is disabled. Enable `tailwindDirectives` in the
  css parser options"，格式化中止；开启后通过。该 parser 仍在补洞：2.3.4 `@source inline(...)`、2.3.5
  `@custom-variant` 内含 `@media`、2.5.2 以数字开头的 `@utility` 名、2.5.9 `@variant` 的 container-query 名；仍开着的
  issue："@variant with selector argument fails to parse even with tailwindDirectives: true"
  <https://github.com/biomejs/biome/issues/8996>。
- 与 Prettier 的分歧是有意为之："In some cases, Biome has intentionally decided to format code in a way that doesn't
  match Prettier's output."：<https://biomejs.dev/formatter/differences-with-prettier/>。官方唯一的兼容数字是 2023-12
  的 "over 96% ... for JavaScript, TypeScript, and JSX"：<https://biomejs.dev/blog/biome-wins-prettier-challenge/>。
- 实测（`indentStyle: space`、`semicolons: asNeeded`、`quoteStyle: single`、`tailwindDirectives: true`）：523 文件
  +27,790/−11,311，CSS +549/−202——与 Prettier 宽度 80 的数量级相同，但具体换行点不同。
- 注意 `vcs.enabled` 默认 false，Biome 默认 **不读 `.gitignore`**，要显式
  `{"vcs": {"enabled": true, "clientKind": "git", "useIgnoreFile": true}}`：<https://biomejs.dev/guides/integrate-in-vcs/>。

## 2. Tailwind v4 class 排序

### prettier-plugin-tailwindcss

- 0.8.1（2026-07-15）；0.8.0 "Requires Prettier 3.7.x minimum"；0.7.0 "Fallback to Tailwind CSS v4 instead of v3 by
  default"、"Improved monorepo support by loading Tailwind CSS relative to the input file"；0.6.9 "Introduce
  `tailwindStylesheet` option to replace `tailwindEntryPoint`"；0.5.12 "Add support for Tailwind CSS v4.0"：
  <https://github.com/tailwindlabs/prettier-plugin-tailwindcss/blob/main/CHANGELOG.md>、
  <https://registry.npmjs.org/prettier-plugin-tailwindcss/latest>。
- `tailwindStylesheet` 是否必需：README 说 "When using Tailwind CSS v4 you must specify your CSS file entry point,
  which includes your theme, custom utilities, and other Tailwind configuration options. To do this, use the
  `tailwindStylesheet` option in your Prettier configuration. Note that paths are resolved relative to the Prettier
  configuration file."（<https://github.com/tailwindlabs/prettier-plugin-tailwindcss/blob/main/README.md>）。代码里有
  回退：`src/sorter.ts` "If we've detected a local version of v4 then we should fallback to using its included theme
  as the stylesheet if the user didn't give us one" → `stylesheet ??= \`${pkgDir}/theme.css\``
  （<https://github.com/tailwindlabs/prettier-plugin-tailwindcss/blob/main/src/sorter.ts>）。也就是说不填也能跑，但只认
  默认主题，`src/index.css` 里的 `@theme` token 与 `@custom-variant` 会被当成未知类。实测差异：带 stylesheet 12 文件
  26 行；不带 19 文件 35 行。
- `tailwindFunctions`："You can sort classes in function calls using the `tailwindFunctions` option, which takes a
  list of function names"，0.7.0 起支持正则；本仓库有 31 处 `cn(`、1 处 `cva(`、1 处 `clsx(`，应填
  `["cn", "cva", "clsx"]`。`tailwindPreserveWhitespace`/`tailwindPreserveDuplicates` 默认会去重和折叠空白。
- 必须放在 `plugins` 数组最后："`prettier-plugin-tailwindcss` *must* be loaded last"；"As of v0.5.x, this plugin now
  requires Prettier v3 and is ESM-only."（README 同上）。
- pnpm / `@tailwindcss/vite`：插件不碰 Vite 插件，自己 `import('tailwindcss')`，从输入文件所在目录解析（修掉了 pnpm
  monorepo 的 <https://github.com/tailwindlabs/prettier-plugin-tailwindcss/issues/340>）；单包仓库无此问题。
- Tailwind 官方 "Editor setup" 页仍只推荐这个插件："We maintain an official Prettier plugin for Tailwind CSS that
  automatically sorts your classes following our recommended class order ... it works anywhere Prettier works"：
  <https://tailwindcss.com/docs/editor-setup>。

### oxfmt `sortTailwindcss`

- "Sort Tailwind CSS classes. Using the same algorithm as prettier-plugin-tailwindcss. Option names omit the
  `tailwind` prefix used in the original plugin"；子选项 `stylesheet`（"Path to your Tailwind CSS stylesheet (v4)"，
  默认 "Installed Tailwind CSS's `theme.css`"，相对 oxfmt 配置文件解析）、`config`（v3）、`functions`、
  `attributes`（均 exact match，不支持正则）、`preserveDuplicates`、`preserveWhitespace`；默认关闭：
  <https://oxc.rs/docs/guide/usage/formatter/config-file-reference.html>、
  <https://oxc.rs/docs/guide/usage/formatter/sorting.html>。0.35.0 去掉了 `experimental` 前缀（"Strip
  `"experimental"SortXxx` prefix (#19567)"，changelog 同上）。
- 实现是 vendored 的 Prettier 插件 sorter（0.67.0 "Bump prettier-plugin-tailwindcss"），在 Node worker 里跑。实测本
  仓库：11 文件 25 行，与 Prettier 插件结果基本一致。
- 已知 issue：`@theme inline` 自定义颜色排序与 Prettier 不同 <https://github.com/oxc-project/oxc/issues/25109>
  （closed as not planned/配置问题）；Vite alias 的 `@import` 不解析 <https://github.com/oxc-project/oxc/issues/21595>；
  Linux 与 macOS 排序结果不同 <https://github.com/oxc-project/oxc/issues/18749>（open）。

### Biome `useSortedClasses`

- 2.5.13 仍是 **nursery**、非 recommended、**unsafe fix**："Currently, utility class sorting is **not part of the
  formatter**, and is implemented as a linter rule instead ... The fix is, at this stage, classified as unsafe. This
  means that **it won't be applied automatically** as part of IDE actions such as 'fix on save'."；不支持
  "Screen variant sorting (e.g. `md:`, `max-lg:`)"、"Custom utilities and variants ... Only the default Tailwind CSS
  configuration is supported."、"the default Tailwind CSS configuration is hard-coded"：
  <https://biomejs.dev/linter/rules/use-sorted-classes/>。选项只有 `attributes`、`functions`，不读项目 CSS。
- Tailwind v4：追踪 issue #1274 的 "Tailwind CSS v4" 仍未勾选；v4 引擎（`sort_v4.rs`）已合入但未接线，接线 PR #11396
  与 stylesheet 配置 PR #11399 于 2026-08 关闭未合并；贡献者 2026-08-24 评论："anything from `@utility` /
  `@custom-variant` / `@theme` or a plugin classifies as unknown and gets left at the front, which is where the
  prettier plugin and this rule diverge on any real project"：
  <https://github.com/biomejs/biome/issues/1274>、<https://github.com/biomejs/biome/issues/6498>。
- 实测本仓库 44 条诊断，例如把 `text-xs text-muted-foreground` 改成 `text-muted-foreground text-xs`——`text-muted-foreground`
  是 `@theme` 里的颜色 token，被当未知类提前。应用 fix 需 `biome check --write --unsafe`。

## 3. 与 ESLint 的分工

### 现有配置里没有格式类规则

逐一核对 `eslint.config.js` extends 的四组配置：

| 配置 | 格式/风格规则 | 来源 |
|--|--|--|
| `js.configs.recommended` | 无（64 条 correctness 规则） | <https://raw.githubusercontent.com/eslint/eslint/main/packages/js/src/configs/eslint-recommended.js> |
| `tseslint.configs.recommended` | 无："None of the preset configs provided by typescript-eslint enable formatting rules ... We strongly recommend you use Prettier or an equivalent for formatting your code, not ESLint formatting rules." | <https://typescript-eslint.io/users/configs/>、<https://typescript-eslint.io/users/what-about-formatting/> |
| `reactHooks.configs.flat.recommended`（v7） | 无 | eslint-plugin-react-hooks 7.1.1 |
| `reactRefresh.configs.vite` | 无（只有 `only-export-components`） | <https://raw.githubusercontent.com/ArnaudBarre/eslint-plugin-react-refresh/main/README.md> |

ESLint 核心自 8.53 起弃用全部格式规则："We recommend using a source code formatter instead of ESLint for formatting
your code."（<https://eslint.org/blog/2023/10/deprecating-formatting-rules/>），它们本来也不在 `eslint:recommended` 里。

### `eslint-config-prettier`

- 作用："Turns off all rules that are unnecessary or might conflict with Prettier."，flat config 写法
  `import eslintConfigPrettier from "eslint-config-prettier/flat"`，最新 10.1.8：
  <https://github.com/prettier/eslint-config-prettier>。
- 把它的规则表与本配置实际启用的规则求交集，只命中 **一条**：`no-unexpected-multiline`（来自 `js.configs.recommended`），
  会被关掉——README 把它列为 "special rule"，说通常与 Prettier 共存无碍。其余被关的 `@typescript-eslint/*` 都是
  typescript-eslint v8 已删除的旧格式规则。
- 结论：对本仓库它是 no-op 并略减覆盖，**不装**。如果想要"以后有人加了格式规则"的守卫，可在 CI 跑它的检查器
  `npx eslint-config-prettier eslint.config.js`（exit 2 表示有冲突）而不 extends 它。
- `eslint-plugin-prettier`（把 Prettier 当 ESLint 规则跑）Prettier 官方不推荐："You end up with a lot of red squiggly
  lines in your editor"、"They are slower than running Prettier directly."、"They're yet one layer of indirection
  where things may break."：<https://prettier.io/docs/integrating-with-linters>。

### 如果让 Biome 接管 lint

- `biome migrate eslint` 能读 flat config（"For flat configuration files, the subcommand will attempt to search for
  JavaScript extension only (`js`, `cjs`, `mjs`)"），但 "You are unlikely to get exactly the same behavior as
  ESLint"，"inspired" 规则默认跳过（需 `--include-inspired`）：<https://biomejs.dev/guides/migrate-eslint-prettier/>。
- 有对应物的只有三条：`rules-of-hooks` → `useHookAtTopLevel`（same as）、`exhaustive-deps` →
  `useExhaustiveDependencies`（inspired）、`react-refresh/only-export-components` →
  `useComponentExportOnlyModules`（style 组，inspired，默认关）：<https://biomejs.dev/linter/rules-sources/>、
  <https://biomejs.dev/linter/rules/use-component-export-only-modules/>。
- eslint-plugin-react-hooks v7 `recommended` 里的 React Compiler 规则（`config`、`error-boundaries`、`gating`、
  `globals`、`immutability`、`preserve-manual-memoization`、`purity`、`refs`、`set-state-in-effect`、
  `set-state-in-render`、`static-components`、`use-memo` 为 error，`unsupported-syntax`、`incompatible-library` 为
  warn；<https://react.dev/reference/eslint-plugin-react-hooks>）**Biome 没有一对一移植**：rules-sources 只映射了
  两条经典 hook 规则；`set-state-in-effect` 的移植 issue <https://github.com/biomejs/biome/issues/6856> 仍开着，
  "React Compiler rules" issue <https://github.com/biomejs/biome/issues/2881> closed as not planned。最接近的是
  2.5.8 新增的 nursery 规则 `useReactCompiler`（"reports diagnostics from React Compiler lint mode"，仅 React 19+，
  单条规则无粒度）：<https://biomejs.dev/linter/rules/use-react-compiler/>。本仓库配置里显式写着
  `'react-hooks/refs': 'error'`、`'react-hooks/set-state-in-effect': 'error'`（与 recommended 重复但表明依赖），
  换 Biome 就是丢掉它们。
- typescript-eslint `recommended` 的 20 条规则里 Biome 有 13 条映射；类型感知 lint 是 2.0 的卖点（"the *first*
  JavaScript and TypeScript linter that provides **type-aware linting rules that doesn't rely on the TypeScript
  compiler**"，`noFloatingPromises` 覆盖 "about 75% of the cases"），但本仓库的 tseslint 配置本来就不是 type-checked，
  无关：<https://biomejs.dev/blog/biome-v2/>。
- Biome formatter 与 ESLint 共存不需要额外配置："Unlike other linters, Biome doesn't provide any rules that check for
  code formatting"（<https://biomejs.dev/linter/>）；Biome 文档没有任何关于 `eslint-config-prettier` 的说法。
- 附带发现：Tolaria 上游仓库根目录有 `biome.json`（2.4.15，`tailwindDirectives: true`，2026-05-26 "fix: resolve codacy
  high severity findings" 引入），但它没有 format script、CI 只跑 `pnpm lint`（ESLint），且从 GitHub 拉下 4 个 src
  文件用该配置 `biome format` 全部报错——即上游 **并未用 Biome 格式化代码**，Fuwa 选型不必向它对齐（来源：
  `gh api repos/refactoringhq/tolaria/contents/{biome.json,package.json,.github/workflows/ci.yml}`，2026-09-12）。

### oxfmt + ESLint

- 官方迁移页："Note that if you intend to continue using ESLint, you *should* keep or add `eslint-config-prettier` to
  disable styling-related ESLint rules that might conflict with Oxfmt."、"Remove `eslint-plugin-prettier` if present.
  If needed, it can be replaced by a `oxfmt --check` job in your CI pipelines."：
  <https://oxc.rs/docs/guide/usage/formatter/migrate-from-prettier.html>。对本仓库同样只影响 `no-unexpected-multiline`。
- oxfmt 不要求 oxlint；维护者："Use oxfmt. Run one after the other like: `oxfmt && oxlint`"：
  <https://github.com/oxc-project/oxc/discussions/19642>。若将来想脱离 ESLint，oxlint 的 `react` 插件原生实现了
  React Compiler 规则（"They are experimental and off by default"，
  <https://oxc.rs/docs/guide/usage/linter/plugins.html>、<https://oxc.rs/blog/2026-08-18-react-compiler-support>），
  是目前唯一有这些规则的非 ESLint linter——Biome 没有。

## 4. 估算首次全量格式化的 diff 大小；`.git-blame-ignore-revs`

### 不跑 formatter 的估法

diff 的大小由"当前代码与目标风格的分歧点数"决定，每一类分歧都能用 grep/awk 数出来。本仓库
（547 个 ts/tsx/mjs 文件，80,284 行）的数字：

| 分歧点 | 计数方法 | 本仓库 |
|--|--|--|
| 分号 | `grep -c ';[[:space:]]*$'` | 34 行有分号 → 代码是 no-semi 风格；`semi: true` 会改动几乎每条语句（约 12.7k 行以 `const/let/return/import` 开头） |
| 引号 | 数 `"..."` 与 `'...'` token | 单引号 18,333 vs 双引号 1,561 → `singleQuote: true` 改 1.5k 处，`false` 改 18k 处 |
| 超宽行 | `awk 'length>N' \| wc -l` | >80：6,023；>100：1,628；>120：380 |
| 缩进/换行符/尾随空白 | `grep -c $'^\t'`、`grep -l $'\r'`、`grep -cE '[[:space:]]+$'` | tab 缩进 79 行，无 CRLF，无尾随空白，2 空格缩进 |
| CSS | 同上，10 文件 3,463 行 | >80 列 135 行，`@apply` 2 处 |

经验换算：每条超宽行被拆成 3–5 行（JSX 属性逐行、链式调用逐行），删除行数 ≈ 超宽行数 × 1.3，插入行数 ≈ 超宽行数 × 4–5；
分号与引号各算一行一处。用这个估：`printWidth 100` + no-semi + 单引号 → 约 −2k/+7k 加引号 1.5k 行；默认配置 → 分号
再加 ~13k 行、双引号 ~18k 处、超宽 6k 行。

### 实测对照（临时 worktree，`--write` 后 `git diff --shortstat`，范围 `src/**/*.{ts,tsx,css}` + `tests/**/*.ts`）

| 配置 | 文件 | 插入 | 删除 |
|--|--|--|--|
| Prettier 3.9.6 默认（semi、双引号、80） | 555 | +63,180 | −46,415 |
| Prettier `semi:false, singleQuote, printWidth:80` | 521 | +27,634 | −11,335 |
| Prettier `semi:false, singleQuote, printWidth:100` | 444 | +14,359 | −8,475 |
| oxfmt 0.67.0 `semi:false, singleQuote`（默认宽 100） | 454 | +14,783 | −8,794 |
| Biome 2.5.13 `asNeeded, single, space`（宽 80） | 523 | +27,790 | −11,311 |
| 仅 Tailwind 排序（Prettier 插件，带 stylesheet + functions） | 12 | +26 | −26 |
| Prettier 对 `**/*.{md,json,yml}`（6 md、2 json、2 yaml） | 10 | +6,475 | −3,943 |

估算与实测的偏差主要在超宽行的级联换行——实际每条超宽行平均产生约 5 行插入。结论：**`printWidth: 100`、no-semi、单引号**
就是代码现状（Tolaria 风格），diff 最小；换成 Prettier 默认值会把几乎每一行都碰一遍。

### 便宜的实测法（不改工作区）

- 只要文件数：`pnpm exec prettier --list-different "src/**/*.{ts,tsx,css}" | wc -l`（"prints the filenames of files
  that are different from Prettier formatting"，<https://prettier.io/docs/cli>）；`oxfmt --list-different`；
  `biome format src`（不带 `--write` 时逐文件打印 diff 并以 `Found N errors.` 计数）。
- 要行数：`git worktree add /tmp/fmt HEAD && cd /tmp/fmt && pnpm exec prettier --write ... && git diff --shortstat`，
  一分钟内出结果，然后 `git worktree remove --force /tmp/fmt`。

### 对 `git diff upstream/main` 的影响

ADR-0001 要求移植文件保持 Tolaria 的结构，"so `git diff upstream/main -- <path>` and `git cherry-pick` stay native
operations"。上游没有 formatter（见第 3 节），全量格式化后这些 diff 会混入换行噪音。缓解办法：比较时把上游文件先过一遍
同样的 formatter——`git show upstream/main:src/components/Editor.tsx | pnpm exec prettier --stdin-filepath
src/components/Editor.tsx | diff - src/components/Editor.tsx`；`git diff -w` 只能吃掉空白差异，吃不掉换行。
`cherry-pick` 之后再跑一次 `prettier --write` 即可。（本机 `git fetch upstream` 目前报 access rights 错误，仓库本身是
public，需要另查凭据。）

### `.git-blame-ignore-revs`

- 文件格式与配置项（`man git-config`）："`blame.ignoreRevsFile` — Ignore revisions listed in the file, one
  unabbreviated object name per line, in git-blame(1). Whitespace and comments beginning with # are ignored."：
  <https://git-scm.com/docs/git-config#Documentation/git-config.txt-blameignoreRevsFile>。`git blame
  --ignore-revs-file <file>`："Lines that were changed or added by an ignored commit will be blamed on the previous
  commit that changed that line or nearby lines."：<https://git-scm.com/docs/git-blame>。
- 配置是 per-clone 的（写在 `.git/config`），每个 clone 要跑一次 `git config blame.ignoreRevsFile
  .git-blame-ignore-revs`；这一句应写进 `AGENTS.md` 的 Setup。**不要 `--global`**：文件不存在时 `git blame` 直接
  `fatal: could not open object name list`（git 2.50.1 实测；JetBrains 因此关掉了
  <https://youtrack.jetbrains.com/issue/IJPL-74006>）。缩写 SHA 会 `fatal: invalid object name`；格式正确但不存在的
  SHA 被静默忽略。
- GitHub 支持：根目录 `.git-blame-ignore-revs` 自动生效，blame 视图显示 "Ignoring revisions in
  .git-blame-ignore-revs" 横幅；只隐藏"introduced new lines or modified existing lines"的 commit，若它是该行最后一次
  修改仍会出现：
  <https://docs.github.com/en/repositories/working-with-files/using-files/viewing-and-understanding-files#ignore-commits-in-the-blame-view>。
- 编辑器：GitLens 13.4.0 起 "Adds auto-detection for `.git-blame-ignore-revs` files"
  （<https://raw.githubusercontent.com/gitkraken/vscode-gitlens/main/CHANGELOG.md>）；JetBrains Annotate 不支持
  （IJPL-76209 自 2019 年起状态 Answered，未修）。
- 顺序：SHA 在 commit 之后才存在，所以是 **两个 commit**——(1) 只含格式化改动的 commit；(2) `git rev-parse HEAD`
  写进 `.git-blame-ignore-revs`（带 `#` 注释）再 commit。不能用 `--amend`（会换 SHA）。push 前跑一次
  `git blame --ignore-revs-file .git-blame-ignore-revs src/App.tsx` 验证。

## 5. 编辑器与 CI 集成

### 编辑器

- Prettier："To get the most out of Prettier, it's recommended to run it from your editor."、"It's important to
  install Prettier locally in every project, so each project gets the correct Prettier version."：
  <https://prettier.io/docs/editors>。VS Code 扩展 `esbenp.prettier-vscode`，`editor.defaultFormatter` 需按语言设
  （"VS Code does not support combined language syntax for `editor.defaultFormatter`"），并 `editor.formatOnSave`：
  <https://github.com/prettier/prettier-vscode>。可在仓库加 `.vscode/settings.json`（当前不存在）。
- Biome：`biomejs.biome` 扩展，`"editor.defaultFormatter": "biomejs.biome"`：<https://biomejs.dev/reference/vscode/>。
- oxfmt：`oxc.oxc-vscode` 扩展（见第 1 节）。

### pre-commit hook：solo 仓库值不值

- Prettier 官方列出的方案：lint-staged（+husky）、pretty-quick（+simple-git-hooks）、Husky.Net、git-format-staged、
  Lefthook、裸 shell 脚本：<https://prettier.io/docs/precommit>。Biome 的 recipe 同样列 Lefthook/Husky/lint-staged
  而不推荐其一：<https://biomejs.dev/recipes/git-hooks/>。
- pnpm 10 的约束："Lifecycle scripts of dependencies are not executed during installation by default!"
  （<https://github.com/pnpm/pnpm/releases/tag/v10.0.0>）——lefthook 2.x 与 simple-git-hooks 2.x 都靠依赖的
  `postinstall` 安装钩子，在 pnpm 10 下会被拦；husky 9 没有 `postinstall`，靠项目自己的 `"prepare": "husky"`
  （<https://typicode.github.io/husky/get-started.html>），项目级 script 不受影响。simple-git-hooks README 也建议改
  用 `prepare`（<https://github.com/toplenboren/simple-git-hooks>）。Tolaria 上游正是 husky + `"prepare": "husky"`，
  pre-commit 跑 `pnpm lint --quiet`。
- 取舍：hook 的价值是"多人各自的编辑器配置不一致"时兜底；solo 仓库里编辑器 format-on-save 一致，CI 的 `--check`
  已能在 push 后几分钟内抓到漏网，hook 只多一个 `prepare` 脚本和每次 commit 的启动开销（Prettier 对本仓库全量
  check 2.5 s，lint-staged 只跑暂存文件会更快）。**建议先不加**；如果发现 CI 因格式挂掉超过一两次再加
  husky + lint-staged（`"*": "prettier --ignore-unknown --write"`，
  <https://github.com/lint-staged/lint-staged>），并在 CI 用 `HUSKY=0` 跳过安装
  （<https://typicode.github.io/husky/how-to.html>）。

### CI `--check` 步骤

- Prettier 安装页："If you have a CI setup, run the following as part of it to make sure that everyone runs
  Prettier"，即 `prettier . --check`，它 "only checks that files are already formatted, rather than overwriting
  them"，未格式化时 exit 1：<https://prettier.io/docs/install>、<https://prettier.io/docs/cli>。忽略规则：
  `.prettierignore` 用 gitignore 语法，且 "Prettier will also follow rules specified in the '.gitignore' file if it
  exists in the same directory from which it is run"：<https://prettier.io/docs/ignore>。
- Biome：`biome ci` "Runs formatting checks, linting checks, and assist actions in CI without modifying files"，在
  GitHub 上以 annotations 输出；有官方 action `biomejs/setup-biome@v2`，但 devDependency 里已有时直接
  `pnpm exec biome ci .` 即可：<https://biomejs.dev/reference/cli/>、<https://biomejs.dev/recipes/continuous-integration/>。
- oxfmt：`"fmt:check": "oxfmt --check"`，无官方 action：<https://oxc.rs/docs/guide/usage/formatter/ci.html>。
- 对 `.github/workflows/ci.yml` 的改动（Prettier 方案），放在 ESLint 之后、Vitest 之前，并在 `package.json` 加
  `"format": "prettier --write ."` 与 `"format:check": "prettier --check ."`：

  ```yaml
        - name: ESLint
          run: pnpm lint

        - name: Prettier
          run: pnpm format:check
  ```

  Rust 侧对称地可加 `cargo fmt --check`（`working-directory: src-tauri`），上游 Tolaria 的 CI 就有这一步。

## 附：建议的落地配置（Prettier 方案）

`package.json`：`pnpm add -D prettier prettier-plugin-tailwindcss`（Prettier 3.9.6 的 `engines.node >=14`，插件
`>=20.19`，本仓库 node >= 22 满足）。

`.prettierrc`：

```json
{
  "semi": false,
  "singleQuote": true,
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"],
  "tailwindStylesheet": "./src/index.css",
  "tailwindFunctions": ["cn", "cva", "clsx"]
}
```

`.prettierignore`（`.gitignore` 会被自动读取，只需补充）：

```
# Markdown is product data in this repo; format it in a later pass if ever.
*.md
# pnpm patches are diffs, not source.
patches/
pnpm-lock.yaml
src-tauri/
```

关于 `printWidth: 100`：Prettier 文档写 "For readability we recommend against using more than 80 characters"
（<https://prettier.io/docs/options>），但也说 printWidth "is not the hard upper allowed line length limit"。本仓库
80,284 行里 6,023 行超过 80 列、只有 1,628 行超过 100 列，Tolaria 上游也按 100 列书写；取 100 让首次 diff 减半
（521 → 444 文件，−11.3k → −8.5k 删除行），并让移植文件与上游更接近。oxfmt 默认恰好也是 100。

落地顺序：(1) 加依赖、`.prettierrc`、`.prettierignore`、`format`/`format:check` script、`.vscode/settings.json`；
(2) `pnpm format` 单独一个 commit（`style: format the tree with Prettier (AIM-408)`），跑 `pnpm tsc && pnpm lint &&
pnpm test` 确认无语义变化；(3) 第二个 commit 加 `.git-blame-ignore-revs` 并在 `AGENTS.md` Setup 里加
`git config blame.ignoreRevsFile .git-blame-ignore-revs`；(4) CI 加 `pnpm format:check`。

## 未能核实的点

- oxfmt 的 CSS 文档称 native Rust，而 npm 包同时打包了 Prettier 的 postcss 插件（用于 HTML/Markdown 内嵌 CSS 还是作为
  回退，未从文档确认）；实测输出与 Prettier 一致，对选型无影响。
- Biome 常被引用的 "97% Prettier 兼容" 在当前任何官方页面都找不到，最后一个官方数字是 96%。
- `prettier-plugin-tailwindcss` 0.8.1 的 npm `peerDependencies` 仍写 `prettier ^3.0`，而 CHANGELOG 写 0.8.0 起
  "Requires Prettier 3.7.x minimum"；本仓库装 3.9.6 两者都满足。
- 上游 Tolaria 的 `git fetch` 在本机因凭据失败，上游内容是通过 `gh api` 读取的。
