---
status: accepted
date: 2026-09-11
---

# Rich/Raw mode is a property of the Tab

Tolaria keeps one editor mode per vault: `useRawMode` reads and writes `editor_mode` in the vault config, so switching to Raw switches every note until the user switches back. Fuwa's spec (section 5, user story 15, AIM-381) wants the opposite: Raw is a per-Document choice, remembered while the Tab is open and written to the Session as `openEditors[].mode`, so two Tabs can sit in different modes and a relaunch restores each.

## Decision

The mode is a field on the kernel's `Tab` (`mode: 'rich' | 'raw'`, absent on an Image Tab), set through the pure Tab rules in `noteTabsState` and carried into the Session by the same effect that writes Tab order. `useRawMode` keeps its file and its flush-before-raw / before-raw-end sequence and only changes where it reads and writes state: the active Tab's `mode`, handed back through `setTabMode`. The editor shell still owns the switch itself (the toggle is registered into a ref, as Tolaria's `rawToggleRef` was), because only it can serialize the rich editor into the raw buffer and map the caret before the other surface mounts.

The Tab rules also carry one invariant: **a Document whose Frontmatter is invalid is always in Raw mode.** Every path that changes a Tab's content (open, restore, save buffer, reload from disk) passes through `applyModeRule`, and `setTabMode` refuses Rich while the rule holds. This is a Tab rule rather than an editor concern because the editor must never mount Rich for such a Document, not even for a frame: BlockNote would render an unclosed `---` as a rule and the next save would rewrite bytes the user never touched.

## Consequences

- A freshly opened Document is Rich; a restored one is whatever its Session entry says; a Document with invalid Frontmatter is Raw whatever was asked, and stays Raw after the user fixes it until they switch, so fixing YAML never yanks the surface out from under the caret.
- Switching Tabs can change `rawMode` without a toggle. The kernel's tab-swap hook already handles that (it skips the BlockNote swap while Raw is on and re-swaps when Raw ends), and the raw editor re-seeds its buffer from the Tab's content when it mounts.
- ⌘S, Tab switches, Move to Trash and quit flush both surfaces: the shell calls the rich flush and the raw flush together (`flushEditorBuffers`), since it does not know which one holds the fresh keystrokes.
- The raw editor's own 500 ms debounce is Raw mode's idle wait; its reports take the Rich path (buffer, then write now) so a refused write becomes the error bar. A report equal to what the Tab already holds is dropped, which is how the raw editor's unmount re-report of a just-flushed edit does not write twice. ADR-0003's note on Raw mode is amended accordingly.
