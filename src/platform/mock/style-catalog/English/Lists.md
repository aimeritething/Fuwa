# Lists

Look at marker alignment, the indent of each nesting level, the gap between items, and how a wrapped line lines up with the first one.

## Flat bullets

- Open the Folder
- Pick a Document in the Explorer
- Start typing
- Let Autosave write the file

## Nested bullets

- Kernel
  - BlockNote
    - Schema
    - Side menu
    - Formatting toolbar
  - Markdown round-trip
    - Parser
    - Serializer
- Shell
  - Sidebar
  - Command Menu
    - Quick Open
- Platform

## Numbered

1. Clone the repository
2. Install the dependencies
3. Start the dev server
4. Open the browser

## Numbered, starting at ten

10. The tenth step
11. The eleventh step
12. The twelfth step
13. The thirteenth step

## Numbered, nested

1. Prepare
   1. Read the issue
   2. Find the code
2. Change
   1. Write a failing test
   2. Make it pass
      1. Smallest change first
      2. Then tidy up
3. Verify

## Mixed nesting

- Before the release
  1. Run the unit tests
  2. Run the smoke specs
  3. Build the app
- During the release
  1. Tag the commit
  2. Upload the bundle
- After the release
  1. Watch the issue tracker

1. Frontend
   - React
   - Tailwind
   - BlockNote
2. Backend
   - Rust
   - Tauri
3. Tooling
   - Vite
   - Vitest

## Checklist

- [ ] Write the release notes
- [x] Bump the version
- [x] Update the changelog
- [ ] Sign the build
- [ ] Publish

## Nested checklist

- [ ] Ship the style catalog
  - [x] Agree on the outline
  - [x] Find the images
  - [ ] Write the Documents
    - [x] English
    - [ ] Chinese
    - [ ] Mixed
  - [ ] Wire it into the fixture
- [x] Keep the old seed unchanged

## Long items

- A long bullet shows how a wrapped line aligns. The second and third lines should start exactly under the first letter of the first line, not under the marker, and the gap between this item and the next one should be the same as between two short items.
- A second long bullet, so the space between two wrapped items is visible. Lists of long items are common in meeting notes and in design documents, where every point is really a small paragraph that happens to have a marker in front of it.
- A short one to close.

1. A long numbered item does the same job for numbers. The number is wider than a bullet, and it grows again at ten, so the text column must leave room for it without shifting when the list gets longer than nine items.
2. A second long numbered item. When the text wraps onto a third line, the block should still read as one item, with the line height of a normal paragraph and no extra space inside it.

- [ ] A long checklist item wraps too. The checkbox should stay aligned with the first line of text, not centred against the whole block, and the text column should match the column of a plain bullet at the same level.
- [x] A long checked item. If checked items are dimmed or struck through, every wrapped line should get the same treatment, including the part that sits on the third line of this deliberately wordy sentence.

## Items with inline styles

- **Bold** at the start of an item
- An item with *italic* in the middle
- An item with `inline code` and a [link](https://example.com)
- An item with ==highlight== and ~~strikethrough~~
- An item with math $x_i$ and a wikilink [[Reading list]]
- `code` as the very first thing in an item

## An ordered item with more inside

1. Install the dependencies.
2. Start the dev server.

   The server listens on port 5202. This is a continuation paragraph that belongs to the second item, so it should be indented to the item's text column.

   ```shellscript
   pnpm install
   pnpm dev
   ```

3. Open the page in a browser.

## Two lists with a paragraph between

- Apples
- Pears
- Plums

This paragraph separates two lists. The space above it and the space below it should match.

- Carrots
- Leeks
- Onions

A closing paragraph directly after a list.
