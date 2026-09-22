# Code

Look at the monospace font and size, the block background and padding, line numbers, the language control, and syntax colours in both themes.

## Inline code

Inline code such as `pnpm dev` or `src/platform/mock/vault-fixture.ts` sits inside a sentence. A longer span like `createMockVault(DEFAULT_MOCK_VAULT_FILES)` should wrap without breaking the line height, and two spans next to each other, `first` `second`, should not touch.

## TypeScript

```ts
export interface MockVaultFile {
  path: string
  kind: 'note' | 'folder' | 'image'
  content?: string
  modifiedAt: number
}

export function isInsideVault(path: string, vaultPath: string): boolean {
  return path === vaultPath || path.startsWith(`${vaultPath}/`)
}
```

## TSX

```tsx
export function PathRow({ crumbs, onCopy }: PathRowProps) {
  return (
    <nav aria-label="Path" className="flex items-center gap-1 text-sm">
      {crumbs.map((crumb) => (
        <span key={crumb.path} data-testid="path-row-crumb">
          {crumb.name}
        </span>
      ))}
      <button type="button" onClick={onCopy}>Copy path</button>
    </nav>
  )
}
```

## Python

```python
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Note:
    path: Path
    title: str

    @classmethod
    def load(cls, path: Path) -> "Note":
        text = path.read_text(encoding="utf-8")
        first = next((line for line in text.splitlines() if line.startswith("# ")), "")
        return cls(path=path, title=first.removeprefix("# ") or path.stem)
```

## Rust

```rust
#[tauri::command]
pub fn get_note_content(path: String, vault_path: Option<String>) -> Result<String, String> {
    let resolved = resolve_inside_vault(&path, vault_path.as_deref())?;
    std::fs::read_to_string(&resolved).map_err(|error| format!("Failed to read file: {error}"))
}
```

## Go

```go
package main

import (
	"fmt"
	"os"
)

func main() {
	entries, err := os.ReadDir(".")
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	for _, entry := range entries {
		fmt.Println(entry.Name())
	}
}
```

## JSON

```json
{
  "name": "plumo",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "vite",
    "test": "vitest run"
  },
  "flags": [true, false, null],
  "ratio": 1.5
}
```

## Shell

```shellscript
#!/usr/bin/env bash
set -euo pipefail

for file in notes/*.md; do
  title="$(grep -m1 '^# ' "$file" | sed 's/^# //')"
  echo "${file}: ${title:-untitled}"
done
```

## CSS

```css
.bn-editor h1 {
  font-size: 1.875rem;
  line-height: 1.25;
  margin-block: 1.5em 0.5em;
}

@media (prefers-color-scheme: dark) {
  .bn-editor { color: oklch(0.92 0 0); }
}
```

## HTML source

An `html` fence becomes an HTML block, so HTML source is shown with an `xml` fence.

```xml
<article class="card">
  <h2>Hello</h2>
  <p>A <strong>static</strong> card with a <a href="https://example.com">link</a>.</p>
  <!-- a comment -->
</article>
```

## SQL

```sql
SELECT folder, COUNT(*) AS documents, MAX(modified_at) AS last_change
FROM notes
WHERE kind = 'note' AND title LIKE '%catalog%'
GROUP BY folder
ORDER BY last_change DESC
LIMIT 10;
```

## Diff

```diff
@@ -12,7 +12,7 @@ export function openWelcome(page: Page) {
   await page.goto('/')
-  await expect(rows).toHaveText(['Notes', 'Attachments', 'Projects'])
+  await expect(rows).toHaveText(['Notes', 'Attachments', 'Projects', 'Style catalog'])
   await page.getByTestId('explorer-row').first().click()
 }
```

## TOML

```toml
[package]
name = "plumo"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = { version = "2", features = ["protocol-asset"] }
serde = { version = "1", features = ["derive"] }
```

## YAML

```yaml
name: ci
on:
  push:
    branches: [main]
jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
```

## Dockerfile

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
```

## Markdown source

The outer fence uses tildes because the body contains a backtick fence.

~~~markdown
# A heading

Some **bold** text and a [link](https://example.com).

```ts
const inner = 'a fence inside a fence'
```

- [ ] a task
~~~

## Plain text

```text
No language and no colours.
Just the monospace font, the background and the line numbers.
```

## Very long lines

```ts
const message = `This line is much longer than the editor is wide, so the block has to scroll sideways instead of wrapping, and the line number has to stay where it is while the text moves under it: ${one} ${two} ${three} ${four} ${five}`
export const DEFAULT_KEYS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliett', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa', 'quebec', 'romeo', 'sierra', 'tango']
```

## A long block

More than forty lines, so the line numbers reach two digits.

```ts
type Listener = (paths: string[]) => void

export class FolderWatcher {
  private listeners = new Set<Listener>()
  private pending = new Set<string>()
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly debounceMs = 150) {}

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  report(path: string): void {
    this.pending.add(path)
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flush(), this.debounceMs)
  }

  private flush(): void {
    const paths = Array.from(this.pending).sort()
    this.pending.clear()
    this.timer = null
    if (paths.length === 0) return
    for (const listener of this.listeners) {
      try {
        listener(paths)
      } catch (error) {
        console.warn('[watcher] A listener threw:', error)
      }
    }
  }

  dispose(): void {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    this.pending.clear()
    this.listeners.clear()
  }
}

export const watcher = new FolderWatcher()
```

## A one-line block

```shellscript
pnpm tsc && pnpm lint && pnpm test
```

## Blank lines inside a block

```python
import sys


def main() -> int:
    print("first section")


    print("after two blank lines")

    return 0


sys.exit(main())
```

## Blocks back to back

```json
{ "first": true }
```

```json
{ "second": true }
```

A closing paragraph directly after a code block.
