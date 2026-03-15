---
aliases: ["Ship Laputa App"]
Is A: Goal
Belongs to: "[[2025]]"
Status: Done
---
# Ship Laputa App

Laputa is a personal knowledge and life management desktop app designed to replace the patchwork of tools currently used to manage the vault of ~9,200 markdown files that power content production, goal tracking, and personal operations. Shipping a usable v1 and adopting it as the daily driver is both a product goal and an infrastructure investment: a better tool for managing knowledge directly improves output quality for [[responsibility-content-production]] and operational clarity across all responsibilities.

## Success criteria

- Ship Laputa v1 as a functional Tauri desktop app with four-panel UI
- Support reading and editing markdown files with YAML frontmatter
- Implement vault navigation, search, and filtering by type
- Use Laputa as the primary daily knowledge management tool (replace current workflow)
- Achieve stable performance with the full ~9,200 file vault

## Key milestones

- Build the core Tauri + React architecture and file I/O layer during [[25q1-laputa-v1]]
- Implement the four-panel UI (sidebar, list, editor, properties) by end of Q1
- Add frontmatter parsing, type filtering, and basic search by mid-Q2
- Iterate on editor experience (CodeMirror 6 integration) during [[25q2-laputa-v2]]
- Reach daily-driver status by end of Q2 and sustain through Q3-Q4

## Notes

- Laputa v1 shipped in March 2025 and has been the daily driver since April. The app handles the full vault without performance issues.
- The Tauri v2 + React + TypeScript stack was the right choice. Desktop performance is excellent and the Rust backend handles file I/O efficiently even at scale.
- The mock layer (`src/mock-tauri.ts`) proved invaluable for rapid UI iteration without needing the full backend running.
- CodeMirror 6 integration was the most complex part of the frontend. Live preview with reveal-on-focus required significant customization.
- [[25q2-laputa-v2]] added refinements: better search, improved frontmatter editing, and the AI chat panel.
- Key lesson: building your own tools is high-leverage when you are the primary user. Every improvement to Laputa directly improves daily workflow efficiency across [[responsibility-content-production]], [[responsibility-personal-finance]], and [[responsibility-learning]].
