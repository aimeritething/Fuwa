# 中英混排 Mixed script

这一篇只看一件事：中文和 English 出现在同一行时，间距、基线、字重和标点是否协调。

## 间距 Spacing

有空格：Plumo 是一个 macOS 上的 Markdown 编辑器，基于 React 和 Tauri 构建。

无空格：Plumo是一个macOS上的Markdown编辑器，基于React和Tauri构建。

数字：这个 Folder 里有 128 个 Document，总共 3.6 MB，最早的一篇写于 2019 年 4 月 7 日。

数字无空格：这个Folder里有128个Document，总共3.6MB，最早的一篇写于2019年4月7日。

单位和符号：宽度 720px，行高 1.7，字号 15pt，缩放 125%，温度 -4°C，比例 16:9，版本 v0.1.0。

## 行内样式 Inline styles

**粗体 bold 混排**，*斜体 italic 混排*，***粗斜体 bold italic***，~~删除线 strikethrough~~。

行内代码：运行 `pnpm dev` 之后打开 `http://localhost:5202`，再按 `⌘P` 调出 Quick Open。

紧贴中文的代码：使用`useEffect`时要注意依赖数组，把`isTauri()`的结果缓存下来。

高亮：==默认的黄色 highlight==、==🟢绿色 green==、==🔴红色 red==、==🔵蓝色 blue==、==🟣紫色 purple==。

链接：请阅读 [BlockNote 的文档](https://www.blocknotejs.org/docs)，或者查看 [`prosemirror-tables`](https://github.com/ProseMirror/prosemirror-tables) 的源码。

Wikilink：参见 [[Reading list]] 和 [[Projects/Plumo|Plumo 项目笔记]]。

行内公式：当 $n \to \infty$ 时，级数 $\sum_{k=1}^{n} \frac{1}{k^2}$ 收敛到 $\frac{\pi^2}{6}$，这就是 Basel 问题。

箭头：Rich mode → Raw mode，Raw mode ← Rich mode，两者 ↔ 互相切换。

组合：**在粗体里放 `inline code` 和 [链接 link](https://example.com)**，再接一段 ==带 `code` 的高亮==，最后是 *斜体里的 English words 和中文*。

## 标点 Punctuation

全角与半角相邻：他说“OK”，然后打开了 Terminal（终端）。版本是 v2.0，不是 v1.9！真的吗？Yes.

半角括号 (like this) 与全角括号（像这样）放在同一行，再加上「直角引号」和《书名号 Title》。

英文引号 "quoted text" 和中文引号“引用的文字”，英文撇号 it's 和 don't，省略号……与 ellipsis...，破折号——与 em dash — 和 en dash –。

连续标点：什么？！真的假的？？好吧……（完）。

行尾标点测试：这一段故意写得比较长，让它在编辑器的宽度里自然换行，这样可以观察逗号、句号、顿号、引号”这类标点落在行首或行尾时，是否被正确处理，English words 是否在合适的位置断开，而不是把一个很长的 URL 比如 https://example.com/a/very/long/path/that/keeps/going/and/going/until/it/wraps 硬生生挤出边界。

## 标题 Headings

# 一级标题 Heading level 1

## 二级标题 Heading level 2 with `code`

### 三级标题 Heading level 3 和 ==高亮 highlight==

#### 四级标题 Heading level 4，带一个 [链接 link](https://example.com)

## 列表 Lists

- 安装依赖：`pnpm install`
- 启动前端 frontend：`pnpm dev`
  - 只跑 mock fixture，不需要 Rust
  - 端口是 5202，被占用时会直接报错 (strictPort)
- 启动完整的 app：`pnpm tauri dev`

1. 打开 Folder，选中一个 Document
2. 按 `⌘\` 切到 Raw mode，检查 Markdown 源码
3. 改完等 Autosave 落盘，再看 `git diff`

- [x] 调整 heading 的 `margin-top`
- [ ] 检查 CJK 字体的 fallback 顺序：PingFang SC → Hiragino Sans GB → system-ui
- [ ] 对比 Light 和 Dark 两种 theme

## 引用与 Callout

> 简洁是可靠的先决条件。Simplicity is prerequisite for reliability.
>
> —— Edsger W. Dijkstra

> [!note] 备注 Note
> Callout 的正文只能是行内内容 inline content，所以这里没有列表，只有一段带 `code` 和 **粗体** 的文字。

> [!warning] 注意 Warning
> 在 `pnpm tauri dev` 里编辑这个目录，Autosave 会直接改动仓库里的文件，记得看 `git status`。

## 表格 Table

| 术语 Term | 中文 | 说明 Description |
| --- | --- | --- |
| Document | 文档 | 磁盘上的一个 `.md` 文件 |
| Folder | 文件夹 | 用户打开的根目录，Explorer 显示它的内容 |
| Rich mode | 富文本模式 | 用 BlockNote 渲染，所见即所得 WYSIWYG |
| Raw mode | 源码模式 | 用 CodeMirror 直接编辑 Markdown 源码 |
| Autosave | 自动保存 | 停止输入一小段时间后写回磁盘 |

## 代码 Code

```ts
// 判断当前是否运行在 Tauri 里；浏览器中由 Folder fixture 代替 Rust 侧
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

const greeting = '你好，world' // 字符串里的中英混排
console.log(`${greeting}：共 ${files.length} 个 Document`)
```

## 图片 Image

![清晨的采尔克尼察湖 Lake Cerknica at dawn](../images/cerknica-landscape.jpg)

图片下面紧跟一段文字，用来看图片与段落之间的间距 spacing。
