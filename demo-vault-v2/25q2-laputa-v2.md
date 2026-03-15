---
aliases: ["Laputa App V2"]
Is A: Project
Belongs to: "[[25q2]]"
Advances: "[[responsibility-learning]]"
Status: Done
Owner: "[[person-luca-rossi]]"
---
# Laputa App V2

## Overview

V2 of Laputa was a major iteration that addressed the rough edges from [[25q1-laputa-v1]] and introduced three headline features: a BlockNote-based rich text editor replacing the raw CodeMirror setup, wiki-link autocomplete for seamless navigation between notes, and a completely redesigned theme system with CSS custom properties. These changes transformed the app from a functional prototype into something that feels genuinely pleasant to use daily.

The BlockNote integration was the most significant architectural change — it provides a block-based editing experience similar to Notion while preserving the underlying markdown format. Wiki-link autocomplete (triggered by typing `[[`) searches across all vault files and inserts links with proper display names. The theme system uses design tokens defined as CSS custom properties, making it straightforward to adjust the visual style without touching component code. This milestone continues the path toward [[2025-ship-laputa]].

## Goals

- Replace the basic CodeMirror editor with BlockNote for a block-based editing experience
- Implement wiki-link autocomplete with fuzzy search across all vault files
- Redesign the theme system using CSS custom properties and a centralized token file
- Improve the property inspector with inline editing for all frontmatter field types
- Fix the top 10 UX issues reported during V1 daily use

## Key decisions

- **BlockNote over plain CodeMirror.** While CodeMirror 6 is excellent for code editing, the reveal-on-focus model proved too jarring for prose-heavy content. BlockNote provides a smoother editing experience where formatting is always visible and blocks can be manipulated as units. The trade-off is less control over the raw markdown, but for the primary use case (structured notes with frontmatter), this is acceptable.
- **CSS custom properties, not a CSS-in-JS theme.** Evaluated styled-components and Tailwind CSS theme approaches but chose plain CSS custom properties. They are natively supported, have zero runtime cost, can be inspected in browser DevTools, and align with the project philosophy of preferring simple, standard approaches over framework-dependent abstractions.
- **Wiki-link search index prebuilt at startup.** The autocomplete needs to search across all ~9,200 files in sub-50ms. Rather than querying the filesystem on each keystroke, the Rust backend builds a search index at startup (including file names, aliases, and titles) and the frontend queries this index. Incremental updates happen when files change.

## Notes

- The BlockNote integration took longer than expected — about 3 weeks of focused work. The main challenge was ensuring that markdown round-tripping (markdown to BlockNote blocks to markdown) preserved formatting perfectly. Several edge cases with nested lists and code blocks required custom serializers.
- Wiki-link autocomplete was the most impactful feature from a daily use perspective. Being able to type `[[` and instantly find any note in the vault by name, alias, or title makes the linking experience far superior to Obsidian's implementation (which does not search aliases by default).
- [[person-david-kim]] continued to provide UX feedback, particularly around keyboard navigation patterns. His suggestion to add Vim-style `j/k` navigation in the note list was implemented and feels natural for power users.
- The theme redesign consolidated about 200 scattered color values into 45 semantic design tokens. This made it trivial to create a dark mode variant (completed in a single afternoon) and establishes a foundation for future theme customization.
- Performance remained solid despite the architectural changes. Note switching is still sub-200ms, and the BlockNote editor handles files up to 5,000 lines without noticeable lag. Memory usage increased by about 15% compared to V1 due to BlockNote's richer DOM, which is acceptable.
- The V2 release was the point where Laputa became genuinely preferable to Obsidian for daily vault management. Feeds into [[25q4-laputa-v3]] for the next major milestone.
