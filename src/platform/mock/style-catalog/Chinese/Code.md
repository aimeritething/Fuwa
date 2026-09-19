# 代码块

这一篇用来看行内代码和各种语言的代码块，重点留意等宽字体里的中文、行号、语法高亮的颜色，以及很长的行怎样横向滚动。

## 行内代码

在段落里提到 `pnpm dev`、`src/platform/mock/vault-fixture.ts` 或者 `const 名字 = "湖"` 的时候，行内代码应当和周围的汉字保持协调的高度。连续出现的情形：`甲`、`乙`、`丙`。带反引号的情形：`` 这里有一个 ` 反引号 ``。

## TypeScript

```ts
// 一条游记的数据结构
interface 游记 {
  标题: string
  日期: Date
  地点: string[]
  已发布: boolean
}

function 摘要(记录: 游记, 字数 = 40): string {
  const 地点 = 记录.地点.join('、')
  const 状态 = 记录.已发布 ? '已发布' : '草稿'
  return `${记录.标题}（${地点}，${状态}）`.slice(0, 字数)
}
```

## TSX

```tsx
// 显示一条待办事项
type 待办属性 = { 文字: string; 完成: boolean; 切换: () => void }

export function 待办条目({ 文字, 完成, 切换 }: 待办属性) {
  return (
    <label className={完成 ? 'line-through opacity-60' : undefined}>
      <input type="checkbox" checked={完成} onChange={切换} />
      <span>{文字}</span>
    </label>
  )
}
```

## Python

```python
# 统计一段文字里每个汉字出现的次数
from collections import Counter


def 统计汉字(文字: str) -> dict[str, int]:
    """只统计汉字，忽略标点和空白。"""
    汉字 = [字 for 字 in 文字 if "一" <= 字 <= "龥"]
    return dict(Counter(汉字).most_common(10))


if __name__ == "__main__":
    print(统计汉字("湖水安静，湖面如镜，湖边无人。"))
```

## Rust

```rust
// 读取文件夹里所有的文稿路径
use std::fs;
use std::path::{Path, PathBuf};

fn 列出文稿(根目录: &Path) -> std::io::Result<Vec<PathBuf>> {
    let mut 结果 = Vec::new();
    for 条目 in fs::read_dir(根目录)? {
        let 路径 = 条目?.path();
        if 路径.extension().is_some_and(|后缀| 后缀 == "md") {
            结果.push(路径);
        }
    }
    结果.sort();
    Ok(结果)
}
```

## Go

```go
package main

import "fmt"

// 行程 表示一天的安排
type 行程 struct {
	日期 string
	地点 []string
}

func main() {
	第一天 := 行程{日期: "九月十九日", 地点: []string{"镇上", "石桥", "湖边"}}
	for 序号, 地点 := range 第一天.地点 {
		fmt.Printf("%d. %s\n", 序号+1, 地点)
	}
}
```

## JSON

```json
{
  "标题": "清晨的湖面",
  "日期": "2026-09-19",
  "标签": ["游记", "湖", "清晨"],
  "字数": 1860,
  "已发布": false,
  "封面": null
}
```

## 命令行脚本

```shellscript
#!/usr/bin/env bash
# 提交之前把该跑的检查都跑一遍
set -euo pipefail

echo "检查类型……"
pnpm tsc

echo "检查代码风格……"
pnpm lint

echo "运行单元测试……"
pnpm test

echo "全部通过。"
```

## 样式表

```css
/* 正文的基本排版 */
.正文 {
  font-family: "PingFang SC", "Noto Sans CJK SC", sans-serif;
  font-size: 16px;
  line-height: 1.75;
  color: var(--文字颜色, #1f2328);
}

.正文 h2 {
  margin-block: 2em 0.5em;
  font-weight: 600;
}
```

## 网页源码

下面用的是 `xml` 标签，因为 `html` 标签的代码块会变成网页块而不是代码。

```xml
<!-- 一张简单的卡片 -->
<article class="卡片">
  <h2>清晨的湖面</h2>
  <p>雾气贴着水面慢慢移动。</p>
  <a href="https://example.com/lake">继续阅读</a>
</article>
```

## SQL

```sql
-- 找出字数最多的五篇游记
SELECT 标题, 日期, 字数
FROM 游记
WHERE 已发布 = TRUE
  AND 日期 >= '2026-01-01'
ORDER BY 字数 DESC
LIMIT 5;
```

## 差异对比

```diff
 # 行前清单
-- [ ] 三脚架
+- [x] 头灯
+- [x] 备用电池
 - [ ] 纸质地图
```

## 配置文件

```toml
# 文稿的默认设置
[文稿]
默认模式 = "富文本"
自动保存 = true
空闲等待毫秒 = 800

[外观]
主题 = "浅色"
字号 = 16
```

```yaml
# 同样的设置，换一种写法
文稿:
  默认模式: 富文本
  自动保存: true
  空闲等待毫秒: 800
外观:
  主题: 浅色
  字号: 16
```

```dockerfile
# 构建前端的镜像
FROM node:22-slim
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
CMD ["pnpm", "dev", "--host"]
```

## 包含代码块的标记文本

~~~markdown
# 一篇小笔记

正文里有一个代码块：

```ts
const 问候 = "你好"
```

代码块之后还有一段文字。
~~~

## 纯文本

```text
这是一块没有语法高亮的纯文本。
它用来看等宽字体下的中文：每个汉字占两个字符的宽度，
所以这两行的右端应当大致对齐，标点也不例外。
```

## 很长的行

```ts
// 这是一条特别长的注释，用来确认代码块在遇到超出宽度的内容时会出现横向滚动条而不是自动换行，同时也用来看滚动的时候行号是不是固定在左边不动，以及中文在等宽字体里连续排很长一行的时候字距是否均匀。
const 很长的一行 = ['镇上', '杨树路', '石桥', '溪边小径', '观景台', '芦苇滩', '瀑布', '山脊', '返程的岔路口', '镇上'].map((地点, 序号) => `${序号 + 1}. ${地点}`).filter((文字) => 文字.length > 0).join(' → ')
```

## 四十行以上的代码

```ts
// 行号到了两位数以后，左侧的宽度不应该跳动
type 天气 = '晴' | '多云' | '阴' | '小雨' | '大雨'

interface 一天 {
  日期: string
  天气: 天气
  步数: number
  备注?: string
}

const 记录: 一天[] = [
  { 日期: '九月十七日', 天气: '晴', 步数: 18230 },
  { 日期: '九月十八日', 天气: '多云', 步数: 21044, 备注: '去看了瀑布' },
  { 日期: '九月十九日', 天气: '小雨', 步数: 9120, 备注: '下午在屋里整理照片' },
]

function 总步数(全部: 一天[]): number {
  return 全部.reduce((和, 天) => 和 + 天.步数, 0)
}

function 平均步数(全部: 一天[]): number {
  if (全部.length === 0) return 0
  return Math.round(总步数(全部) / 全部.length)
}

function 下雨的日子(全部: 一天[]): 一天[] {
  return 全部.filter((天) => 天.天气 === '小雨' || 天.天气 === '大雨')
}

function 描述(天: 一天): string {
  const 备注 = 天.备注 ? `，${天.备注}` : ''
  return `${天.日期}，${天.天气}，走了 ${天.步数} 步${备注}。`
}

function 报告(全部: 一天[]): string {
  const 行 = 全部.map(描述)
  行.push(`一共走了 ${总步数(全部)} 步，平均每天 ${平均步数(全部)} 步。`)
  行.push(`其中有 ${下雨的日子(全部).length} 天在下雨。`)
  return 行.join('\n')
}

console.log(报告(记录))
```

## 只有一行的代码块

```shellscript
pnpm dev
```

## 中间有空行的代码块

```python
第一段 = "空行之前"


第二段 = "两个空行之后"

第三段 = "一个空行之后"
```

代码块之后的普通段落，用来看代码块下方的间距。
