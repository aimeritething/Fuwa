# Typography

Look at heading sizes and the space around them, paragraph rhythm, every inline style, and how blockquotes sit between paragraphs.

## Headings

# Heading level one

The largest heading. A Document normally has one, and it doubles as the title.

## Heading level two

The main section heading. Check the space above it against the space below it.

### Heading level three

A subsection heading. It should still read as a heading, not as bold body text.

#### Heading level four

The smallest heading with a dedicated style. It sits close to the paragraph it introduces.

##### Heading level five

Level five parses as a heading, but it has no dedicated style yet.

###### Heading level six

Level six parses as a heading too, and it also has no dedicated style yet.

### Headings back to back

#### A level four directly under a level three

Two headings in a row should not stack their margins into a large gap.

---

## Paragraphs

A short paragraph.

A long paragraph shows line height, measure and the colour of body text better than anything else on this page. Most of what people read in Fuwa is plain prose, so this is the block that has to feel right before any of the others matter. Read it at the narrowest and the widest window size, and watch where the lines break. A comfortable measure sits somewhere between sixty and eighty characters, and the line height should leave enough air that the eye finds the start of the next line without effort. If the text looks grey and tight, the line height is too small. If it looks like a list of separate sentences, the line height is too large.

The first of two consecutive paragraphs. The gap between this paragraph and the next one is the paragraph spacing, and it should be clearly smaller than the gap above a heading.

The second of two consecutive paragraphs. It ends here, and three blank lines follow it in the source. The second and third blank lines each become an empty paragraph.



This paragraph comes after the run of blank lines. The empty paragraphs above it should each be exactly one line tall.

---

## Inline styles

**Bold text** marks the words that matter.

*Italic text* marks a title or a light emphasis.

***Bold and italic*** together, for the rare case that needs both.

~~Strikethrough~~ marks something that no longer holds.

`inline code` marks a name that a computer reads.

==Yellow highlight== is the default colour.

==🟢Green highlight== uses a green circle after the opening marks.

==🔴Red highlight== uses a red circle.

==🔵Blue highlight== uses a blue circle.

==🟣Purple highlight== uses a purple circle.

A [plain link](https://example.com) points at a web page.

A link with a code label: [`createMockVault`](https://example.com/docs/create-mock-vault).

A wikilink: [[Reading list]].

A wikilink with an alias: [[Projects/Fuwa|the Fuwa project note]].

Inline math: $E=mc^2$ and $\frac{a}{b}$ sit on the text baseline.

Arrows: input → output, result ← source, client ↔ server.

Escaped characters: \*not italic\*, \[not a link\], \~not struck\~, and a price written as \$5.

### Inline styles in a real paragraph

The watcher reports **every change** inside the Folder, including the ones Fuwa made itself, so the first thing `handleExternalChange` does is *drop the paths it just wrote*. What is left is ==real outside work==: a file saved from another editor, a ~~rename~~ move in Finder, or a `git checkout` that rewrote half the tree. The [design note](https://example.com/notes/watcher) explains why the debounce is $2x$ the Autosave idle wait, and [[Session|the Session note]] covers what happens to a Tab when its file goes away → it stays open, marked as missing, until the file comes back.

---

## Combinations

A link with bold inside: [the **important** part of the link](https://example.com).

Bold with code inside: **run `pnpm test` before every commit**.

Italic with a link inside: *see [the changelog](https://example.com/changelog) for details*.

Highlight with bold inside: ==this is **really** worth a second look==.

Strikethrough with code inside: ~~call `legacySave()` first~~.

### A heading with ==highlight== and `inline code`

The heading above carries a highlight and a code span. Both should keep the heading's size and weight.

#### A heading with a [link](https://example.com) and **bold**

The link inside a heading should not shrink to body size.

---

## Blockquotes

> A single-line quote.

> A quote that runs over several source lines.
> Each line continues the same quote,
> and the block should read as one piece of text.

> The first part of a quote with an empty line in the middle.
>
> The second part, after the empty quoted line. The bar on the left should run through the gap without a break.

> A quote with inline styles: **bold**, *italic*, `code`, ==highlight==, a [link](https://example.com) and math $x_i$.

A paragraph directly after a quote. Check the space between the quote and this line.

> A quote directly before a heading.

### The heading after the quote

The last paragraph on the page. The space below it is the scroll-beyond-last-line area.
