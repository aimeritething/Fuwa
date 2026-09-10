---
status: accepted
date: 2026-09-11
---

# The renderer owns the quit sequence

The spec (section 5) makes a Write failure the only prompt in the app: ⌘Q flushes every pending Autosave first and, if any flush fails, the app stays open and asks Retry, Discard changes or Discard and quit. ADR-0004 left open how the renderer gets into the exit path, and noted that the native Quit item terminates through `applicationWillTerminate`, which reaches the event loop as `Exit` with nothing able to hold it. Tao's app delegate implements only `applicationWillTerminate`, so there is no `applicationShouldTerminate` to answer "later" from.

## Decision

Quit is a manifest command like every other menu item. The app menu's Quit item is a manifest `appMenu` entry (`app-quit`, ⌘Q) rather than the predefined item, so ⌘Q and App → Quit Fuwa reach the renderer as a `menu-event` and nothing terminates yet. The renderer's `useWriteFailures.quit` writes the active Document's fresh keystrokes and pending buffer, writes every Document whose last write stands refused again, in Tab order, and asks about the first that is refused again. Only once every write has landed, or the user chose Discard and quit, does it call the `quit_app` command, which is `app.exit(0)`: that arrives as `ExitRequested { code: Some(0) }`, where the Session file is flushed once more (ADR-0004), then `Exit`.

The same hook owns the rest of the Write failure surface: a refusal is recorded against its Document and shown as the error bar on that Tab; closing such a Tab asks instead of closing; a write that lands from anywhere clears it. Every settle (Tab switch, close, ⌘S, ⌘Q) writes the active Document's buffer only (`savePendingForPath`), so another Document's refused edits, which the save hook keeps in its single buffer, are never written or recorded under the wrong Tab; they wait for their own bar's Retry or the quit loop. Retry writes that kept buffer again, with the rich editor's fresh keystrokes flushed into it first, and falls back to the Tab's copy when the buffer has since moved to another Document. The save hook gains `discardPending`; the Tabs hook gains `reloadTab`, which puts the disk bytes back for Discard changes. A Document that cannot be read back (the file is gone) has no bytes to go back to, so Discard closes its Tab, as spec section 5 does for a Document deleted from outside.

## Consequences

- A termination the renderer never sees (Dock → Quit, log out, shutdown) still reaches the event loop as `Exit` alone: the Session file is flushed, pending Document writes are not. That is the pre-existing behaviour and the spec's ⌘Q is what this ticket covers.
- Escape dismisses the prompt in both cases: the Tab, or the app, stays open with its error bar. Nothing is ever discarded without a click on a Discard button.
- The Command Menu will list Quit like any other menu-bar command, which the glossary requires.
- The kernel's `useEditorSave` is edited (`discardPending`), as it was for ADR-0002; ADR-0003's "the kernel's hooks are not edited" described that decision, not a rule.
