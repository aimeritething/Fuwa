---
aliases: ["Laputa App V3"]
Is A: Project
Belongs to: "[[25q4]]"
Advances: "[[responsibility-learning]]"
Status: Open
Owner: "[[person-luca-rossi]]"
---
# Laputa App V3

## Overview

V3 represents the most ambitious Laputa milestone yet, introducing three headline features that take the app from a desktop-only vault browser to a truly integrated knowledge management system: mobile sync (read/write access to the vault from an iPhone), AI-powered note linking (automatic suggestions for connections between notes), and a quick capture menu bar widget for frictionless note creation without opening the full app.

The mobile sync challenge is primarily architectural — the vault is a local directory of markdown files, and syncing across devices requires either a cloud sync layer (iCloud, Dropbox) or a custom sync protocol. The AI linking feature uses embeddings to find semantically related notes that may not share explicit wiki-links. Quick capture provides a lightweight input surface that integrates with macOS system-wide, accessible via a keyboard shortcut. This milestone continues the path toward [[2025-ship-laputa]].

## Goals

- Implement mobile sync via iCloud Drive for read/write vault access on iOS
- Build an AI note linking system that suggests related notes based on semantic similarity
- Create a menu bar quick capture widget (macOS) for instant note creation via keyboard shortcut
- Optimize app performance for vaults exceeding 10,000 files (anticipating vault growth)
- Ship a beta release to a small group of testers (5-10 people) for external feedback

## Key decisions

- **iCloud Drive for sync, not custom backend.** Evaluated building a custom sync server, using Dropbox API, or leveraging iCloud Drive. iCloud was chosen because it is native to the Apple ecosystem (where most potential users are), requires zero server infrastructure, and handles conflict resolution at the file level. The downside is platform lock-in (no Android sync), but the user base is overwhelmingly macOS/iOS.
- **Embedding-based similarity, not keyword matching.** The AI linking system uses text embeddings (via a local model, not cloud API) to compute semantic similarity between notes. This catches connections that keyword matching would miss — for example, a note about "team retrospectives" being related to a note about "learning from failure" even though they share no common terms. Running locally preserves privacy and eliminates API costs.
- **Menu bar widget as a Tauri secondary window.** Rather than a separate app, the quick capture widget is a secondary Tauri window that can be toggled via a global keyboard shortcut. This keeps the implementation within the existing codebase and shares the Rust backend for file operations.

## Notes

- The iCloud Drive integration is the most technically uncertain component. Tauri's file system access works well for local directories, but iCloud Drive introduces sync conflicts, delayed availability, and platform-specific behaviors that need careful handling. Early prototyping is focused on identifying and handling edge cases before building the full sync UI.
- The AI linking prototype is showing promising results. Using a local embedding model (all-MiniLM-L6-v2), the system generates similarity scores between all vault notes. For a 9,200-file vault, the full embedding computation takes about 45 seconds — acceptable as a one-time startup cost with incremental updates for changed files.
- [[person-david-kim]] has agreed to be one of the beta testers. His experience with developer tools and his own extensive note-taking practice make him an ideal early user. Planning to recruit 4-5 additional testers from the [[25q3-community-launch]] Discord.
- The quick capture widget addresses a genuine daily friction point. Currently, capturing a quick thought requires opening the full Laputa app, navigating to the right location, and creating a new note. The menu bar widget reduces this to: hit keyboard shortcut, type, hit enter. The captured note gets filed with a timestamp and can be processed later.
- Performance optimization work has begun with profiling the app under load with 10K+ files. The main bottleneck is the initial file scan and frontmatter parsing — exploring a caching layer that persists parsed metadata between sessions to avoid re-parsing unchanged files.
- V3 is planned for completion by end of [[25q4]], which would fulfill [[2025-ship-laputa]] with a feature-complete app that handles the full vault management workflow across devices.
