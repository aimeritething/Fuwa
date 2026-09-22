# Callouts

Look at the icon, the title row, the background and border colour of each visual family, and the space around a callout.

## Note family

> [!note] Note
> A neutral aside. It adds context without asking the reader to do anything.

> [!abstract] Abstract
> A short summary of what follows, for readers who will not read the whole Document.

> [!info] Info
> A fact worth knowing: the Folder fixture lives in memory, so edits last until the page reloads.

> [!todo] Todo
> Something still open. Replace the placeholder images before the release.

## Success family

> [!tip] Tip
> Press ⌘P to jump to any Document by name without touching the Explorer.

> [!success] Success
> The write landed. Nothing else is shown, because a quiet save is the normal case.

## Warning family

> [!question] Question
> Should the Session remember the Rich or Raw mode of every Tab, or only of the active one?

> [!warning] Warning
> This Document changed on disk while it was open. Your unsaved edits are kept until you choose.

## Error family

> [!failure] Failure
> The smoke spec failed: the Explorer showed four rows where five were expected.

> [!danger] Danger
> Deleting a folder moves everything inside it to the Trash, including files Plumo does not show.

> [!bug] Bug
> The line numbers drift by one pixel per ten lines in WebKit. Tracked, not yet fixed.

## Example family

> [!example] Example
> A file named `2026-09-19 Meeting.md` sorts by date when the Explorer sorts by name.

## Quote family

> [!quote] Quote
> Simplicity is prerequisite for reliability. — Edsger W. Dijkstra

## Without a title

> [!note]
> A callout with no title. The type name stands in for it.

> [!warning]
> A warning with no title of its own.

## Aliases

> [!summary] Summary is an alias of abstract
> It should look exactly like the abstract callout above.

> [!hint] Hint is an alias of tip
> It should look exactly like the tip callout.

> [!caution] Caution is an alias of warning
> It should look exactly like the warning callout.

> [!error] Error is an alias of danger
> It should look exactly like the danger callout.

> [!cite] Cite is an alias of quote
> It should look exactly like the quote callout.

## Unknown type

> [!custom] A type Plumo does not know
> The type keeps its name and takes the look of a note.

## Long body

> [!info] How Autosave decides when to write
> Autosave waits until you stop typing, then writes the whole Document in **one** call to `save_note_content`. If that call fails, the *Write failure* bar appears and stays until a later write succeeds, and the text you typed is ==never discarded== in the meantime. The idle wait belongs to the editing surface rather than to the Kernel, which is why a Raw mode edit and a Rich mode edit behave the same way; the reasoning is written up in [the decision record](https://example.com/adr/0003). The formula is simple: the wait restarts on every change, so a burst of $n$ keystrokes produces one write, not $n$.

## Adjacent callouts

> [!tip] First of two
> This callout is directly followed by another one.

> [!warning] Second of two
> The gap between the two should match the gap between a callout and a paragraph.

## Between a heading and a code block

### A heading directly above a callout

> [!example] Right under a heading
> The callout follows the heading with nothing in between, and a code block follows the callout.

```ts
const callout = { type: 'example', title: 'Right under a heading' }
```

## Title with inline styles

> [!note] A title with `code` and **bold**
> The title row should cope with inline styles without changing height.

## Collapsible syntax stays a quote

The `+` and `-` markers are not supported, so the block below stays a plain blockquote.

> [!tip]+ Collapsible
> This text is part of an ordinary quote, and the marker line above it is shown as written.

A closing paragraph directly after a quote.
