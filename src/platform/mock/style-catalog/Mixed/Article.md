---
title: 给 Tauri 应用做一个浏览器里的假后端
tags: [tauri, testing, mock]
---
# 给 Tauri 应用做一个浏览器里的假后端

Tauri 应用的前端是一个普通的 web app，后端是 Rust。两边通过 `invoke()` 通信：前端发一个命令名和一组参数，Rust 侧返回结果。这个边界很窄，也正因为窄，它特别适合被替换掉。这篇笔记记录我们怎样用一个 in-memory fixture 代替整个 Rust 侧，让 `pnpm dev` 和 Playwright 的 smoke spec 都能在普通的 Chromium 里运行。

## 为什么不直接跑完整的 app

完整地启动一次 `pnpm tauri dev` 需要编译 Rust。冷启动大约 90 秒，增量编译也要 5–10 秒。而调样式、改交互这类工作，绝大多数时候根本碰不到 Rust。

> 反馈回路每慢一秒，你愿意尝试的想法就少一个。

更麻烦的是测试。WKWebView 没有官方的 WebDriver 支持，想用 Playwright 驱动一个真正的 Tauri 窗口，要绕很多弯路。如果前端能脱离 Rust 独立运行，这些问题就都不存在了：

- 启动时间从 90 秒降到 1 秒以内
- 可以用任何浏览器的 DevTools
- Playwright 直接 `page.goto('/')` 就能开始测试
- CI 上不需要 macOS runner，也不需要 Rust toolchain

代价是你得维护一个假的后端，并且保证它和真的足够像。

## 找到边界

第一步是确认边界真的只有一处。在我们的代码里，所有对 Rust 的调用都经过同一个函数：

```ts
import { invoke as tauriInvoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '@/platform/tauri'

export function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return isTauri() ? tauriInvoke<T>(command, args) : mockInvoke<T>(command, args)
}
```

`isTauri()` 的判断很简单：看 `window` 上有没有 Tauri 注入的 `__TAURI_INTERNALS__`。在普通浏览器里它不存在，于是所有命令都流向 `mockInvoke`。

> [!tip] 先收口，再替换
> 如果你的代码里到处都是直接 `import { invoke } from '@tauri-apps/api/core'`，先花半天把它们收到一个 wrapper 里。这一步本身就值得做，和 mock 无关。

## fixture 长什么样

核心是一个 `Map<string, MockVaultFile>`，key 是绝对路径，value 是文件的内容和元数据。它用一个大的 `switch` 回答命令：

| 命令 Command | 真实的 Rust 侧 | fixture 里 |
| --- | --- | --- |
| `list_files` | 递归扫描磁盘，跳过隐藏文件 | 过滤 Map 的 key，同样跳过 `.` 开头的路径 |
| `get_note_content` | `fs::read_to_string` | `files.get(path).content` |
| `save_note_content` | 原子写入：先写临时文件再 rename | `files.set(path, …)` |
| `start_vault_watcher` | 启动 `notify` watcher | 只记下被监听的路径 |
| `read_session` | 读 app data 目录里的 JSON | 读 `localStorage` |

没有列出来的命令一律 reject，错误信息是 `No mock handler for command: <name>`。这一点很重要：**宁可让 spec 大声失败，也不要让 fixture 悄悄返回 `undefined`**。

### seed

Map 的初始内容叫 seed。默认的 seed 只有几个很小的文件，够让 Explorer、Tab 和 Quick Open 有东西可显示。每个 spec 可以在开头用 `reset(seed)` 换上自己需要的文件。

```ts
await page.evaluate((path) => {
  window.__fuwaMockVault?.reset([
    { path, kind: 'note', content: '# Draft\n', modifiedAt: 1_757_500_000, fileSize: 8 },
  ])
}, `${MOCK_FOLDER}/Draft.md`)
```

### 模拟“别的程序”

真实世界里，用户会在 Finder 里移动文件，会用 `git checkout` 换掉整个目录。fixture 为此提供了一组不经过命令、也不记入调用日志的方法：

1. `writeNote(path, content)`：另一个编辑器保存了文件
2. `removeFile(path)` 和 `movePath(from, to)`：Finder 里的删除和移动
3. `emitExternalChange(paths)`：watcher 上报变更

把它们组合起来，就能测 “Tab 开着的时候文件被外部删除” 这类很难手工复现的场景。

## 保持两边一致

假后端最大的风险是 ==drift==：Rust 侧改了行为，fixture 没跟上，测试全绿，app 却是坏的。我们用三条规则压住它：

- **形状照抄。** 参数名、返回值的字段、时间戳的单位（秒，不是毫秒）都和 Rust 的 command 完全一致。
- **错误信息照抄。** `Path must stay inside the active vault` 这样的字符串在两边是同一个常量的两份拷贝，前端靠它们决定显示哪种 Write failure。
- **关键逻辑共享测试用例。** `list_files` 的过滤规则在 Rust 和 TypeScript 两边跑同一组 fixture 目录。

> [!warning] fixture 不是 spec
> fixture 通过，只说明前端在“理想的后端”面前行为正确。原子写入、文件权限、符号链接这些只有真实文件系统才有的问题，仍然要靠 `cargo test` 和手工验证。

![橡树山上向东望去的群山 Mountain panorama from Oak Mountain](../images/oak-mountain-panorama.jpg)

## 结果

迁移之后的几个数字：

| 指标 | 之前 | 之后 |
| --- | --- | --- |
| 前端冷启动 | ~90 s | 0.8 s |
| smoke spec 数量 | 0 | 90 |
| 一轮 smoke 耗时 | — | 2 min 40 s |
| 需要 Rust toolchain 的贡献者比例 | 100% | 约 30% |

最意外的收获其实不是速度，而是 fixture 逼着我们把 “前端到底依赖后端的哪些行为” 写成了可执行的代码。读一遍那个 `switch`，就知道整个 app 和磁盘之间的全部契约。

## 如果你也想这么做

- [x] 把所有 `invoke` 调用收进一个 wrapper
- [x] 列出前端启动所需的最小命令集，通常不到十个
- [ ] 为每个命令写一个 in-memory 的实现，未实现的命令直接 throw
- [ ] 把 fixture 挂到 `window` 上，让 Playwright 可以 seed 和断言
- [ ] 为会 drift 的逻辑建立共享的测试用例

延伸阅读：[Tauri 的 mocking 文档](https://tauri.app/develop/tests/mocking/)，以及 Playwright 的 [`page.addInitScript`](https://playwright.dev/docs/api/class-page#page-add-init-script)。
